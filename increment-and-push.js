const shell = require("shelljs");

if (shell.exec("git status --porcelain").stdout !== "") {
  console.log("no!");
}
