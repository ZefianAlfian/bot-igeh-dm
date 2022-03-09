module.exports = {
  name: "igstalk",
  // aliases: ["h"],
  run: async (conn, m, args) => {
    let usr = await conn.ig.user.getIdByUsername((args[0]).replace("@", ""));
    let acc = await conn.ig.user.info(usr);
    if (acc.is_private){
    	conn.sendDM(m.sender.pk, "User private");
    	return;
    }
    console.log(acc)
    conn.sendDM(m.sender.pk, `Username: ${acc.username}\nFull Name: ${acc.full_name}`)
  },
};
