const { IgApiClient, IgCheckpointError } = require("instagram-private-api");
const { urlSegmentToInstagramId } = require("instagram-id-to-url-segment");
const { withFbnsAndRealtime } = require("instagram_mqtt");
const Bluebird = require("bluebird");
const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio")
const axios = require("axios")
const ig = withFbnsAndRealtime(new IgApiClient());
const inquirer = require("inquirer");
const { Collection } = require("@discordjs/collection");
const path = require("path");
const didYouMean = require("didyoumean");

const questionUp = (other) => [
  {
    type: "input",
    name: "username",
    message: "[>] Insert Username :",
    validate: function (value) {
      if (!value) return "Can't Empty";
      return true;
    },
  },
  {
    type: "password",
    name: "password",
    message: "[>] Insert Password :",
    mask: "*",
    validate: function (value) {
      if (!value) return "Can't Empty";
      return true;
    },
  },
  ...other,
];

module.exports.IGConn = class {
  constructor(argss) {
    this.prefix = "/";
    (async () => {
      if (fs.existsSync("./state.json")) {
        await this.readState(ig);
      } else {
        await this.loginToInstagram(ig);
      }

      ig.fbns.on("auth", async () => {
        console.log("Connected");
        await this.saveState(ig);
      });

      ig.fbns.on("direct_v2_message", async (m) => {
      // console.log(m)
      //auto read
        const items = await ig.feed.directPending().items();
        items.forEach(
          async (item) => await ig.directThread.approve(item.thread_id)
        );
        ig.realtime.direct
          .markAsSeen({
            threadId: m.actionParams.id,
            itemId: m.actionParams.x ? m.actionParams.x : m.actionParams.t,
          })
          .catch(() => console.error("Mark as seen error !"));
        let content = m.message
          .split(":")
          .slice(1, m.message.split(":").length)
          .join(":");
        let contentp = content.substring(1, content.length).startsWith(this.prefix)
          ? content.substring(1, content.length)
          : "";
        m.body = contentp;
        m.sender = await ig.user.info(m.sourceUserId);
        this.commands = new Collection();
        this.mean = [];
        this.aliases = new Collection();

        fs.readdirSync(path.join(__dirname + "/../commands")).forEach((dir) => {
          const commands = fs
            .readdirSync(path.join(__dirname + `/../commands/${dir}`))
            .filter((file) => file.endsWith(".js"));
          for (let file of commands) {
            let pull = require(`../commands/${dir}/${file}`);
            if (pull.name) {
              this.mean.push(pull.name);
              this.commands.set(pull.name, pull);
            } else {
              continue;
            }
            if (pull.aliases && Array.isArray(pull.aliases))
              pull.aliases.forEach((alias) =>
                this.aliases.set(alias, pull.name)
              );
          }
        });
        let argv = m.body.slice(1).trim().split(/ +/).shift().toLowerCase();
        let args = m.body.trim().split(/ +/).slice(1);
        let command = this.commands.get(argv);
        if (!command) command = this.commands.get(this.aliases.get(argv));

        if (content.includes("https://instagram.com/p/") || content.includes("https://www.instagram.com/p/")){
       	 	let URL = content;
	        let regExp = /\/p\/(.*?)\//;
        	URL = "https://instagram.com/p/" + URL.match(regExp)[1]
        	this.sendDM(m.sender.pk, "Sedang di proses mohon tunggu sebentar.")
        	fetch("https://instasave.website/download#downloadhere", {
        	                    "credentials": "include",
        	                    "headers": {
        	                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0",
        	                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        	                        "Accept-Language": "en-US,en;q=0.5",
        	                        "Content-Type": "application/x-www-form-urlencoded",
        	                        "Upgrade-Insecure-Requests": "1"
        	                    },
        	                    "referrer": "https://instasave.website/",
        	                    "body": `link=${URL}&submit=`,
        	                    "method": "POST",
        	                    "mode": "cors"
        	                }).then((res) => res.text())
        	                    .then((text) => {
        	                        const $ = cheerio.load(text)
        	                        const url__ = $('#downloadBox > a:nth-child(3)').attr('href');
        	                        this.getBuffer(url__).then(vid => this.sendVideo(m.sender.pk, vid))
        	                        console.log('[IG Download] Succses ' + m.sender.username)
        	                    })
        	                .catch((err) => {
        	                    console.log('[IG Download]', err)
        	                    this.sendDM(m.sender.pk, "Mohon Maaf Ada Kesalahan Silahkan Coba Ulang")
        	                })
        }
        if (
          this.mean.includes(didYouMean(argv, this.mean)) &&
          !this.mean.includes(argv)
        ) {
          this.sendDM(
            m.sender.pk,
            `Mungkin yang anda maksud adalah ${this.prefix}${didYouMean(
              argv,
              this.mean
            )}`
          );
        }
        if (command) {
          console.log(`[USER] ${m.sender.username} : ${command.name}`);
          command.run(this, m, args);
        }
        // console.log(m);
      });

      ig.fbns.on("error", console.error);
      ig.fbns.on("warning", console.error);
      ig.realtime.on("error", console.error);
      ig.realtime.on("close", () => console.error("RealtimeClient closed"));

      await ig.realtime.connect({
        irisData: await ig.feed.directInbox().request(),
      });
      await ig.fbns.connect();
    })();
  }
  /**
   * Send a dm to a specific user
   * @param {string} id The id or pk of the user
   * @param {string} content The content of the message to send
   */
  async sendDM(id, content) {
    let thread = ig.entity.directThread([id.toString()]);
    await thread.broadcastText(content);
  }
  async sendFoto(id, buffer) {
  	let thread = ig.entity.directThread([id.toString()]);
  	await thread.broadcastPhoto({ allowFullAspectRatio: true, file: buffer });
  }
  async sendVideo(id, buffer) {
  	let thread = ig.entity.directThread([id.toString()]);
  	await thread.broadcastVideo({ video: buffer})
  }
  async getBuffer (url, options) {
  	try {
  		options ? options : {}
  		const res = await axios({
  			method: "get",
  			url,
  			headers: {
  				'DNT': 1,
  				'Upgrade-Insecure-Request': 1
  			},
  			...options,
  			responseType: 'arraybuffer'
  		})
  		return res.data
  	} catch (e) {
  		console.log(`Error : ${e}`)
  	}
  }
  async readState(ig) {
    if (!fs.existsSync("state.json")) return;
    await ig.importState(
      await fs.readFileSync("./state.json", { encoding: "utf8" })
    );
  }
  async saveState(ig) {
    return fs.writeFileSync("./state.json", await ig.exportState(), {
      encoding: "utf8",
    });
  }
  async loginToInstagram(ig) {
    return new Promise(async (resolve, reject) => {
      const { username, password } = await inquirer.prompt(questionUp([]));
      Bluebird.try(async () => {
        ig.request.end$.subscribe(() => this.saveState(ig));
        ig.state.generateDevice(username);
        // await ig.simulate.preLoginFlow();
        await ig.account.login(username, password);
        // process.nextTick(async () => await ig.simulate.postLoginFlow());
        resolve(await this.saveState(ig));
      }).catch(IgCheckpointError, async () => {
        ig.state.generateDevice(username);
        console.log(ig.state.checkpoint);
        await ig.challenge.auto(true);
        console.log(ig.state.checkpoint);
        await ig.challenge.sendSecurityCode(code);
        resolve(await this.saveState(ig));
      });
    });
  }
};
