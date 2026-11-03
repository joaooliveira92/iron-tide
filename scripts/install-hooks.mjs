#!/usr/bin/env node
// Install the tracked git hooks by pointing Git at `.githooks/`.
//
// Dependency-free on purpose: ADR-0099 rejected adding hook tooling, and a
// committed hook directory plus `core.hooksPath` needs no package. Runs from
// `prepare`, so a normal `pnpm install` wires it up; also runnable directly.

import { execFileSync } from "node:child_process";
import { chmodSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function git(args, options = {}) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", ...options });
}

try {
  git(["rev-parse", "--git-dir"], { stdio: "ignore" });
} catch {
  console.log("install-hooks: not a git worktree; skipping");
  process.exit(0);
}

let current = "";
try {
  current = git(["config", "core.hooksPath"]).trim();
} catch {
  current = "";
}
if (current === ".githooks") {
  console.log("install-hooks: already installed (core.hooksPath = .githooks)");
  process.exit(0);
}

try {
  const hooksDir = resolve(root, ".githooks");
  for (const entry of readdirSync(hooksDir)) chmodSync(resolve(hooksDir, entry), 0o755);
  git(["config", "core.hooksPath", ".githooks"]);
  console.log("install-hooks: core.hooksPath -> .githooks (pre-commit, commit-msg, pre-push)");
} catch (error) {
  console.warn(`install-hooks: could not install hooks: ${error.message}`);
  process.exitCode = 0;
}
