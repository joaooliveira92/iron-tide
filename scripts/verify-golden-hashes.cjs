const { execFileSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const childScript = path.resolve(
  __dirname,
  "..",
  "packages",
  "cross-process-test",
  "dist",
  "run-child.js",
);
const goldenPath = path.resolve(__dirname, "..", "golden", "hashes.json");

const stdout = execFileSync(process.execPath, [childScript], {
  encoding: "utf8",
  timeout: 30000,
});
const lines = stdout.trim().split("\n");
const actual = JSON.parse(lines[lines.length - 1]);
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));

const keys = Object.keys(golden);
let ok = true;
for (const key of keys) {
  if (actual[key] !== golden[key]) {
    console.error("MISMATCH: " + key + " actual=" + actual[key] + " golden=" + golden[key]);
    ok = false;
  }
}
if (ok) {
  console.log("All " + keys.length + " hashes match golden reference");
} else {
  process.exit(1);
}
