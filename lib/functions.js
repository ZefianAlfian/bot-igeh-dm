const fetch = require("node-fetch");
const cheerio = require("cheerio");

const igDownload = async (URL) => {
  return new Promise((resolve, reject) => {
    fetch("https://instasave.website/download#downloadhere", {
      credentials: "include",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded",
        "Upgrade-Insecure-Requests": "1",
      },
      referrer: "https://instasave.website/",
      body: `link=${URL}&submit=`,
      method: "POST",
      mode: "cors",
    })
      .then((res) => res.text())
      .then((text) => {
        const $ = cheerio.load(text);
        let buf = [];
        $("#downloadBox")
          .find("a")
          .each(function () {
            let linkBuf = $(this).attr("href").replace("&dl=1", "");
            buf.push(linkBuf);
          });
        resolve(buf);
      })
      .catch((err) => {
        console.log("[IG Download]", err);
      });
  });
};

module.exports = {
  igDownload,
};
