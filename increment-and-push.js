const shell = require("shelljs");

console.log(shell.exec("git status --porcelain").stdout);
