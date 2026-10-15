#!/usr/bin/env node
// Validates commit subjects against the Conventional Commits format used across
// the repository (see `git log --oneline`). Run it in CI over the pushed/PR
// range so a malformed subject cannot merge, or from the `commit-msg` hook on a
// single message file.
//
//   COMMIT_RANGE="origin/main..HEAD" node scripts/check-commit-msgs.cjs
//   node scripts/check-commit-msgs.cjs --message-file .git/COMMIT_EDITMSG
//
// Defaults to the last commit (HEAD~1..HEAD). Merge, revert, fixup! and squash!
// commits are skipped. If the range cannot be resolved (e.g. a shallow checkout
// or a mistyped COMMIT_RANGE), the check fails closed in CI (naming the range)
// and skips locally, so a missing range never blocks a developer's run.
const { execFileSync } = require("child_process");
const { readFileSync } = require("fs");

const range = process.env.COMMIT_RANGE || "HEAD~1..HEAD";
const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];
const SUBJECT = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9._/-]+\\))?!?: .+\\S$`);
const SKIP = /^(Merge |Revert |fixup!|squash!)/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// True when the run should treat an unresolvable range as fatal. CI is the
// authority on the committed tree, so it fails closed; a local run (an
// unreachable COMMIT_RANGE) only skips, so a missing range never blocks an
// unrelated run. Mirrors the `isStrictEnvironment` helper in the other gates.
function isStrictEnvironment(env = process.env) {
  const value = env.CI;
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

// commit-msg hook mode: validate one message file (first non-comment line).
const messageFileIndex = process.argv.indexOf("--message-file");
if (messageFileIndex !== -1) {
  const file = process.argv[messageFileIndex + 1];
  if (!file) {
    console.error("commit-msg check: --message-file requires a path");
    process.exit(1);
  }
  const subject = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.trim())
    .find((line) => line !== "");
  if (!subject) {
    console.error("commit-msg check: empty commit message");
    process.exit(1);
  }
  if (SKIP.test(subject) || SUBJECT.test(subject)) {
    console.log(`commit-msg check: ok ("${subject}")`);
    process.exit(0);
  }
  console.error(`commit-msg check: subject is not a Conventional Commit: "${subject}"`);
  console.error(`Allowed types: ${TYPES.join(", ")} (e.g. "fix(combat): ...")`);
  process.exit(1);
}

let subjects;
try {
  subjects = git(["log", "--no-merges", "--format=%s", range]).split("\n").filter(Boolean);
} catch {
  if (isStrictEnvironment()) {
    console.error(`commit-msg check: range "${range}" is unavailable; failing closed`);
    process.exit(1);
  }
  console.log(`commit-msg check: range "${range}" is unavailable; skipping`);
  process.exit(0);
}

const bad = subjects.filter((subject) => !SKIP.test(subject) && !SUBJECT.test(subject));
if (bad.length > 0) {
  console.error(`commit-msg check: ${bad.length} subject(s) are not Conventional Commits:`);
  for (const subject of bad) console.error(`  ${subject}`);
  console.error(`Allowed types: ${TYPES.join(", ")} (e.g. "fix(combat): ...")`);
  process.exit(1);
}

console.log(`commit-msg check: ok (${subjects.length} subject(s) in "${range}")`);
