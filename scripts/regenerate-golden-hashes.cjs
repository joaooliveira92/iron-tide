// scripts/regenerate-golden-hashes.cjs
// ADR-0007 golden-hash regeneration mechanism: runs the cross-process child
// (packages/cross-process-test/dist/run-child.js — compile -> execute month ->
// save/load -> replay) twice, asserts the two runs are byte-identical, and
// atomically rewrites golden/hashes.json ONLY after that reproducibility
// check passes. Never edit golden/hashes.json by hand; this script is the
// single sanctioned way to update it (canonical artifact change per
// ENGINEERING-CONTRACT: report old/new + cause in the change description).
const { execFileSync } = require("child_process");
const { readFileSync, writeFileSync, renameSync, existsSync } = require("fs");
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

function runChild() {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

const golden = existsSync(goldenPath) ? JSON.parse(readFileSync(goldenPath, "utf8")) : null;

// Reproducibility gate: two independent child runs MUST produce identical
// hashes before any golden is accepted (ADR-0007 §"golden hash file").
const runA = runChild();
const runB = runChild();
for (const key of Object.keys(runA)) {
  if (runA[key] !== runB[key]) {
    console.error(`NON-REPRODUCIBLE: ${key} runA=${runA[key]} runB=${runB[key]}`);
    process.exit(1);
  }
}

const tmpPath = `${goldenPath}.tmp`;
writeFileSync(tmpPath, JSON.stringify(runA, null, 2) + "\n", "utf8");
renameSync(tmpPath, goldenPath);

console.log("Golden hashes regenerated (reproducibility gate: two identical child runs).");
if (golden) {
  for (const key of Object.keys(golden)) {
    const marker = golden[key] === runA[key] ? "unchanged" : "CHANGED  ";
    console.log(`${marker} ${key}\n    old=${golden[key]}\n    new=${runA[key]}`);
  }
} else {
  console.log(JSON.stringify(runA, null, 2));
}
console.log("Verify with: node scripts/verify-golden-hashes.cjs");
