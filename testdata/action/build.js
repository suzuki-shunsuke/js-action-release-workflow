// A minimal build script for testing. It requires semver to check node_modules is restored.
const fs = require("fs");
const semver = require("semver");
fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("src/index.js", "dist/index.js");
console.log(`built with semver ${semver.valid("1.2.3")}`);
