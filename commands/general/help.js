module.exports = {
  name: "help",
  aliases: ["h"],
  run: async (conn, m, args) => {
    conn.sendDM(m.sender.pk, "Command help");
  },
};
