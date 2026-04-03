const { findUser: lookup } = require("./lib");

function run() {
  return lookup();
}

module.exports = { run };
