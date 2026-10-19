#!/usr/bin/env node
// Commit-time form of the golden re-pin guard (ADR-0238). Called by the `commit-msg` hook with the
// message file; reads the staged paths and applies the same predicate as `verify-golden-repin.mjs`,
// so a missing `Golden-Repin: not-needed` trailer is caught while the commit is still amendable.
//
//   node scripts/check-golden-repin-staged.mjs --message-file .git/COMMIT_EDITMSG

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { collectProblems } from "./verify-golden-repin.mjs";

const SKIPPED_SUBJECT_RE = /^(Merge |Revert |fixup! |squash! )/;

/**
 * @param {string[]} paths - paths staged for the commit
 * @param {string} message - the commit message being written
 * @returns {string[]} the authoritative paths needing a re-pin or trailer; empty when none
 */
export function stagedRepinProblems(paths, message) {
  const subject = message.trimStart().split("\n")[0] ?? "";
  if (SKIPPED_SUBJECT_RE.test(subject)) return [];
  const [problem] = collectProblems([{ hash: "staged", subject, message, paths }]);
  return problem === undefined ? [] : problem.files;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const flag = process.argv.indexOf("--message-file");
  const file = flag === -1 ? undefined : process.argv[flag + 1];
  if (file === undefined) {
    console.error("golden-repin (staged): --message-file <path> is required");
    process.exit(2);
  }
  const paths = execFileSync("git", ["diff", "--cached", "--name-only", "--no-renames"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const files = stagedRepinProblems(paths, readFileSync(file, "utf8"));
  if (files.length > 0) {
    console.error("golden-repin (staged): this commit changes authoritative source:");
    for (const path of files) console.error(`  ${path}`);
    console.error(
      "Update golden/hashes.json in this commit (node scripts/regenerate-golden-hashes.cjs), or if no\n" +
        "reference hash moves, add a `Golden-Repin: not-needed` trailer with the reason (ADR-0007).",
    );
    process.exit(1);
  }
}
