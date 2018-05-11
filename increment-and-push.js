const shell = require("shelljs");
const fs = require("fs");
const path = require("path");

function tryExec(cmd) {
  let { code, stdout } = shell.exec(cmd);
  if (code !== 0) {
    console.log("command failed.");
    console.log(stdout);
    shell.exit(1);
    throw new Error("Failed");
  }
  return stdout;
}

if (shell.exec("git status --porcelain").stdout !== "") {
  console.log("Git is not clean. Be sure to commit everything before running this script.");
  shell.exit(1);
}

console.log("Building TypeScript files...");
tryExec("npm run build");

let package = require("./package.json");
let versionNumbers = package.version.split(".").map(val => parseInt(val, 10));
versionNumbers[versionNumbers.length - 1]++;
let newVersion = versionNumbers.join(".");
package.version = newVersion;

console.log("Updating package.json to version " + newVersion + "...");
fs.writeFileSync(path.join(__dirname, "package.json"), JSON.stringify(package, null, 2));

console.log("Committing built version...");

tryExec('git commit -a -m "Auto-built and version incremented"');
