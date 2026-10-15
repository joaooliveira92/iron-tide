#!/usr/bin/env node
// Cross-process determinism and idempotency proof for the content codemod (SPM-R20, SPM-R21;
// ticket 11c). Each fresh process migrates the authoritative legacy content and runs the
// idempotency suite (source → staged → staged); the printed manifest-content SHA-256 must match
// across processes. The idempotency suite also runs in both processes, so a non-fixed point
// fails the gate rather than only the hash comparison.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "content-codemod",
);

const FILES = ["test/determinism.test.ts", "test/publish.test.ts"];

function migrateOnce() {
  const out = execFileSync("pnpm", ["exec", "vp", "test", "run", "--reporter=verbose", ...FILES], {
    cwd: pkg,
    encoding: "utf8",
    timeout: 300000,
    shell: process.platform === "win32",
  });
  const match = /CODEMOD_TREE_SHA256 ([0-9a-f]{64})/.exec(out);
  if (match === null) throw new Error("codemod determinism: tree hash not found in test output");
  return match[1];
}

const first = migrateOnce();
const second = migrateOnce();
if (first !== second) {
  console.error(`codemod determinism: runs differ\n${first}\n${second}`);
  process.exit(1);
}
console.log(`codemod determinism: two fresh processes byte-identical (tree sha256 ${first})`);
console.log("codemod idempotency: source → staged → staged fixed point verified in both processes");
