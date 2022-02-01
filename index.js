const { IgApiClient } = require("instagram-private-api");
const axios = require("axios");
const { random } = require("lodash");
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

ig.state.generateDevice("worldofrizqi");
// ig.state.proxyUrl = "https://98.12.195.129:443"
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

const getAllTargetFollowing = async (
  username,
  list = "followings",
  after = null
) => {
  const cookie =
    'csrftoken=8B8zUE6Cxm4YZUtwNMVb1auW3viDRHzx; ds_user_id=10888503271; ig_did=5B9F3B4E-EC50-458F-BB43-DB1BB28180ED; ig_direct_region_hint="PRN\05410888503271\0541675058483:01f74ca563cb19a1529e3a3a0b4fc1d466d87fabbbe5010148d1a47ab69225354f8b283d"; ig_nrcb=1; mid=YfJuOwABAAEFbsjOmWSUvsaowiIQ; rur="EAG\05410888503271\0541675165777:01f7a0ecdd50934acba52ea91fe250ad2a4675502867939ed34d9c68cba737e206c75f51"; sessionid=10888503271:I4vw05umx2SwG0:13; shbid="18561\05410888503271\0541675141750:01f7967076dd06343375870fd403173c04c39b5579e97735bcbed79949451e49d3f9e123"; shbts="1643605750\05410888503271\0541675141750:01f7884f6c5ff93de6f6c22a1c2d3a4d1c4902027de990e976989c15c4e63c8214f0d219"';
  const cnfg = {
    jar: ig.state.cookieJar,
    headers: {
      cookie,
      "User-Agent": ig.state.appUserAgent,
      "X-Ads-Opt-Out": ig.state.adsOptOut ? "1" : "0",
      "X-DEVICE-ID": ig.state.uuid,
      "X-CM-Bandwidth-KBPS": "-1.000",
      "X-CM-Latency": "-1.000",
      "X-IG-App-Locale": ig.state.language,
      "X-IG-Device-Locale": ig.state.language,
      "X-Pigeon-Session-Id": ig.state.pigeonSessionId,
      "X-Pigeon-Rawclienttime": (Date.now() / 1000).toFixed(3),
      "X-IG-Connection-Speed": `${random(1000, 3700)}kbps`,
      "X-IG-Bandwidth-Speed-KBPS": "-1.000",
      "X-IG-Bandwidth-TotalBytes-B": "0",
      "X-IG-Bandwidth-TotalTime-MS": "0",
      "X-IG-Extended-CDN-Thumbnail-Cache-Busting-Value":
        ig.state.thumbnailCacheBustingValue.toString(),
      "X-Bloks-Version-Id": ig.state.bloksVersionId,
      "X-MID": ig.state.extractCookie("mid")?.value,
      "X-IG-WWW-Claim": ig.state.igWWWClaim || "0",
      "X-Bloks-Is-Layout-RTL": ig.state.isLayoutRTL.toString(),
      "X-IG-Connection-Type": ig.state.connectionTypeHeader,
      "X-IG-Capabilities": ig.state.capabilitiesHeader,
      "X-IG-App-ID": ig.state.fbAnalyticsApplicationId,
      "X-IG-Device-ID": ig.state.uuid,
      "X-IG-Android-ID": ig.state.deviceId,
      "Accept-Language": ig.state.language.replace("_", "-"),
      "X-FB-HTTP-Engine": "Liger",
    },
  };
  // const src = await axios.get(`https://www.instagram.com/${username}/?__a=1`, {headers:{"User-Agent":"Mozilla/5.0 (Linux; Android 11; RMX3201) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36", cookie: cookie}});
  const src = await axios.get(`https://www.instagram.com/${username}/?__a=1`, {
    ...cnfg,
  });
  // const a = S(src.data).between('<script type="text/javascript">window._sharedData = ', ';</script>');
  const result = [];
  let id = src.data.graphql.user.id;
  const res = await axios.get(
    `https://www.instagram.com/graphql/query/?query_hash=${
      config[list].hash
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
      list,
      res.data.data.user[config[list].path].page_info.end_cursor
    );
    result.push(...nPage);
    // console.log(nPage)
  }
  return result;
  // console.log(res.data.data.user)
};

const getAllItemsFromFeed = async (feed) => {
  let items = [];
  do {
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
};

// end func

const unfollNotFollback = async (ig, username, password) => {
  await ig.simulate.preLoginFlow();
  const acc = await ig.account.login(username, password);
  process.nextTick(async () => await ig.simulate.postLoginFlow());

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

const followByTargetFollowing = async (ig, username, password, target) => {
  await ig.simulate.preLoginFlow();
  const acc = await ig.account.login(username, password);
  process.nextTick(async () => await ig.simulate.preLoginFlow());

  const followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId);
  const ToFollow = await getAllTargetFollowing(target);
  const Ufollowing = await getAllItemsFromFeed(followingFeed);

  const UfolUID = new Set(Ufollowing.map(({ username }) => username));
  const toFollowing = ToFollow.filter(
    ({ node }) => !UfolUID.has(node.username) && !node.requested_by_viewer
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

const start = async () => {
  try {
    const choise = (await inquirer.prompt(questionTools)).tools;

    switch (choise) {
      case "[1] Unfollow not follback":
        var { username, password } = await inquirer.prompt(questionUp([]));
        await unfollNotFollback(ig, username, password);
        console.log("Selesai");
        break;
      case "[2] Follow by target following":
        var { username, password, tfollow } = await inquirer.prompt(
          questionUp([
            {
              type: "input",
              name: "tfollow",
              message: "[>] Insert target Username to follow the followed :",
              validate: function (value) {
                if (!value) return "Can't Empty";
                return true;
              },
            },
          ])
        );
        followByTargetFollowing(ig, username, password, tfollow);
        break;
      default:
        console.log(
          "\nERROR:\n[?] Aw, Snap! \n[!] Something went wrong while displaying this program!\n[!] Please try again!"
        );
    }
  } catch (err) {
    console.log(err.message);
  }
};

start();
