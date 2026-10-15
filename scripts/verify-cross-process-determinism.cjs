#!/usr/bin/env node
// Cross-process determinism proof (ADR-0007): run the reference child twice in
// separate processes and assert the two canonical hash reports are byte-identical.
//
// `verify-golden-hashes.cjs` compares one run against the committed reference;
// this additionally proves repeatability across processes without relying on the
// committed golden, so a corrupted/incorrect re-pin cannot hide a nondeterminism.
// Both are now part of `pnpm check` so local green equals CI green.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const childScript = path.resolve(
  __dirname,
  "..",
  "packages",
  "cross-process-test",
  "dist",
  "run-child.js",
);

function runOnce() {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 60000,
  });
  const lines = stdout.trim().split("\n");
  const payload = lines[lines.length - 1];
  // The child prints a JSON object as its last line; compare the bytes of that
  // line so serialization order is part of the proof.
  return payload;
}

const first = runOnce();
const second = runOnce();

if (first !== second) {
  console.error("cross-process determinism: the two child runs differ");
  console.error("run 1: " + first);
  console.error("run 2: " + second);
  process.exit(1);
}

console.log("cross-process determinism: two runs byte-identical");
