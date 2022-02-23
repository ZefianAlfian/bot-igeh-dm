const { IgApiClient, IgCheckpointError } = require("instagram-private-api");
const axios = require("axios");
const { random } = require("lodash");
const Bluebird = require("bluebird");
const fs = require("fs");
const ig = new IgApiClient();
const inquirer = require("inquirer");

const config = {
  followers: {
    hash: "c76146de99bb02f6415203be841dd25a",
    path: "edge_followed_by",
  },
  followings: {
    hash: "d04b0a864b4b54837c0d870b0e77e076",
    path: "edge_follow",
  },
};

const questionTools = [
  {
    type: "list",
    name: "tools",
    message: "Select tools : ",
    choices: [
      "[1] Unfollow not follback",
      "[2] Follow by target following",
      {
        name: "Contact support",
        disabled: "Unavailable at this time",
      },
      new inquirer.Separator(),
    ],
  },
];

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

const loginNsave = async () =>
  new Promise(async (resolve, reject) => {
    Bluebird.try(async () => {
      const { username, password } = await inquirer.prompt(questionUp([]));
      ig.state.generateDevice(username);
      const auth = await ig.account.login(username, password);
      const cookieJar = await ig.state.serializeCookieJar();
      fs.writeFileSync(
        "./savedCookie.json",
        JSON.stringify(cookieJar),
        "utf-8"
      );
      let device = (({ deviceString, deviceId, uuid, adid, build }) => ({
        deviceString,
        deviceId,
        uuid,
        adid,
        build,
      }))(ig.state);
      fs.writeFileSync("./savedDevice.json", JSON.stringify(device), "utf-8");
      resolve(ig);
    }).catch(IgCheckpointError, async () => {
      console.log(ig.state.checkpoint); // Checkpoint info here
      await ig.challenge.auto(true); // Requesting sms-code or click "It was me" button
      console.log(ig.state.checkpoint); // Challenge info here
      const { username, password, code } = await inquirer.prompt(
        questionUp([
          {
            type: "input",
            name: "code",
            message: "Enter code",
          },
        ])
      );
      await ig.challenge.sendSecurityCode(code);
      await ig.account.login(username, password);
      resolve(ig);
    });
  });

const getAllTargetFollowing = async (
  username,
  igh,
  list = "followings",
  after = null
) => {
  const cookie = `csrftoken=${
    (await igh.state.serializeCookieJar()).cookies[0].value
  }; sessionid=${
    (await igh.state.serializeCookieJar()).cookies[4].value
  }; mid=${(await igh.state.serializeCookieJar()).cookies[1].value}`;

  const cnfg = {
    headers: {
      cookie,
      "User-Agent": igh.state.webUserAgent,
    },
  };
  const src = await axios.get(`https://www.instagram.com/${username}/?__a=1`, {
    ...cnfg,
  });
  const result = [];
  let id = src.data.graphql.user.id;
  const res = await axios.get(
    `https://www.instagram.com/graphql/query/?query_hash=${
      config.followings.hash
    }&variables=${encodeURIComponent(
      JSON.stringify({
        id: id,
        include_reel: false,
        fetch_mutual: true,
        first: 50,
        after: after,
      })
    )}`,
    { ...cnfg }
  );
  // console.log(JSON.stringify(res.data))
  result.push(...res.data.data.user[config[list].path].edges);
  if (res.data.data.user[config[list].path].page_info.has_next_page) {
    let nPage = await getAllTargetFollowing(
      username,
      igh,
      list,
      res.data.data.user[config[list].path].page_info.end_cursor
    );
    result.push(...nPage);
  }
  return result;
};

const getAllItemsFromFeed = async (feed) => {
  let items = [];
  do {
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
};

// end func

const unfollNotFollback = async (ig) => {
  const followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId);
  const followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId);

  const followers = await getAllItemsFromFeed(followersFeed);
  const following = await getAllItemsFromFeed(followingFeed);

  const followersUserId = new Set(followers.map(({ pk }) => pk));
  const notFollowingYou = following.filter(
    ({ pk }) => !followersUserId.has(pk)
  );
  console.log(`Total unfoll : ${notFollowingYou.length}`);
  for (const user of notFollowingYou) {
    await ig.friendship.destroy(user.pk);
    console.log(`unfollowed ${user.username}`);
    const time = Math.round(Math.random() * 6000) + 4000;
    await new Promise((resolve) => setTimeout(resolve, time));
  }
};

// unfollNotFollback(ig)

const followByTargetFollowing = async (ig, target) => {
  const username = (await ig.account.currentUser()).username;
  const followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId);
  const ToFollow = await getAllTargetFollowing(target, ig);
  const Ufollowing = await getAllItemsFromFeed(followingFeed);
  const UfolUID = new Set(Ufollowing.map(({ username }) => username));
  const toFollowing = ToFollow.filter(
    ({ node }) =>
      !UfolUID.has(node.username) &&
      !node.requested_by_viewer &&
      node.username !== username
  );
  console.log(`Total follow : ${toFollowing.length}`);
  for (const user of toFollowing) {
    await ig.friendship.create(user.node.id);
    console.log(`followed ${user.node.username}`);
    const time = Math.round(Math.random() * 6000) + 4000;
    await new Promise((resolve) => setTimeout(resolve, time));
  }
};

// followByTargetFollowing(ig);

const getSessionIg = async () =>
  new Promise(async (resolve, reject) => {
    if (
      fs.existsSync("./savedCookie.json") &&
      fs.existsSync("./savedDevice.json")
    ) {
      const { restoreSession } = await inquirer.prompt([
        {
          type: "confirm",
          name: "restoreSession",
          message: "Found session, restore?",
        },
      ]);
      if (!restoreSession) {
        const { delSes } = await inquirer.prompt([
          {
            type: "confirm",
            name: "delSes",
            message: "Delete session ?",
          },
        ]);
        if (delSes) {
          fs.unlinkSync("./savedCookie.json");
          fs.unlinkSync("./savedDevice.json");
          resolve(await loginNsave());
          return;
        } else {
          return resolve(await loginNsave());
        }
      }
      console.log("Loading device and session from disk...");
      let savedCookie = fs.readFileSync("./savedCookie.json", "utf-8");
      let savedDevice = JSON.parse(
        fs.readFileSync("./savedDevice.json"),
        "utf-8"
      );
      await ig.state.deserializeCookieJar(savedCookie);
      ig.state.deviceString = savedDevice.deviceString;
      ig.state.deviceId = savedDevice.deviceId;
      ig.state.uuid = savedDevice.uuid;
      ig.state.adid = savedDevice.adid;
      ig.state.build = savedDevice.build;
      resolve(ig);
    } else {
      resolve(await loginNsave());
    }
  });

const start = async () => {
  try {
    const choise = (await inquirer.prompt(questionTools)).tools;

    switch (choise) {
      case "[1] Unfollow not follback":
        var ses = await getSessionIg();
        await unfollNotFollback(ses);
        console.log("Selesai");
        break;
      case "[2] Follow by target following":
        var ses = await getSessionIg();
        let { tfollow } = await inquirer.prompt([
          {
            type: "input",
            name: "tfollow",
            message: "[>] Insert target Username to follow the followed :",
            validate: function (value) {
              if (!value) return "Can't Empty";
              return true;
            },
          },
        ]);
        await followByTargetFollowing(ses, tfollow);
        console.log("Selesai");
        break;
      default:
        console.log(
          "\nERROR:\n[?] Aw, Snap! \n[!] Something went wrong while displaying this program!\n[!] Please try again!"
        );
    }
  } catch (err) {
    console.log(err);
  }
};

start();
