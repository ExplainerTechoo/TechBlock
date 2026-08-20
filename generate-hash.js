const crypto = require("crypto"); module.exports = () => console.log(crypto.randomBytes(32).toString("hex"));
