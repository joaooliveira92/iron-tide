#!/usr/bin/env node
// Branch-discipline hook (production-hardening ticket 03, ADR-0165).
//
// Refuse a commit made directly on a protected integration branch (`dev`,
// `main`). The incident this closes (ADR-0044): two agents committing in the
// same `dev` checkout, where one agent's `git add -A` swept the other's
// uncommitted files into a commit and left `dev` self-inconsistent, and a later
// `git reset` silently reverted uncommitted work. Work now lands on a
// short-lived branch in a dedicated worktree and reaches `dev` through a pull
// request that must pass the required checks.
//
// Wired into `.githooks/pre-commit` (installed by `pnpm install`). Bypass a hook
// deliberately with `git commit --no-verify`; CI re-runs the real gates.
//
// Usage:
//   node scripts/check-branch-discipline.mjs              # read the current branch
//   node scripts/check-branch-discipline.mjs --self-test  # embedded fixtures
//
// The decision is a pure function of the branch name; it reads no clock, RNG,
// environment, or network.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Integration branches that must only move through a reviewed pull request. */
export const PROTECTED_BRANCHES = ["dev", "main"];

/**
 * @param {string} branch
 * @returns {boolean}
 */
export function isProtectedBranch(branch) {
  return PROTECTED_BRANCHES.includes(branch);
}

/**
 * @param {{ branch: string }} input
 * @returns {string[]} problems, empty when the commit is allowed.
 */
export function branchDisciplineProblems({ branch }) {
  if (isProtectedBranch(branch)) {
    return [
      `refusing to commit on the protected branch "${branch}" — ` +
        `commit on a short-lived branch instead and land it via a pull request`,
    ];
  }
  return [];
}

function currentBranch() {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
}

function selfTest() {
  /** @type {{ branch: string, want: number }[]} */
  const cases = [
    { branch: "dev", want: 1 },
    { branch: "main", want: 1 },
    { branch: "feat/production-hardening", want: 0 },
    { branch: "hardening/maintainability", want: 0 },
    // A detached HEAD (CI, or a bisect) reports "HEAD" and is allowed: nothing
    // is being committed *on* an integration branch.
    { branch: "HEAD", want: 0 },
    { branch: "develop", want: 0 },
    { branch: "development", want: 0 },
  ];
  let failed = 0;
  for (const { branch, want } of cases) {
    const got = branchDisciplineProblems({ branch }).length;
    if (got !== want) {
      console.error(`self-test FAILED: "${branch}" expected ${want} problem(s), got ${got}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error(`check-branch-discipline: ${failed} self-test(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(`check-branch-discipline: self-test passed (${cases.length} cases)`);
}

function main() {
  const branch = currentBranch();
  const problems = branchDisciplineProblems({ branch });
  if (problems.length > 0) {
    console.error("branch-discipline: FAILED\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nCommit on a short-lived branch in a dedicated worktree, and land it via a\n" +
        "pull request that passes the required checks (ADR-0165; the divergence this\n" +
        "prevents is recorded in ADR-0044). If this commit is genuinely exceptional,\n" +
        "re-run it with `git commit --no-verify`.",
    );
    process.exit(1);
  }
  console.log(`branch-discipline: ok (on "${branch}", not a protected branch)`);
}

// Only run the CLI when this module is the entrypoint, so importing it from the
// fixtures runs nothing (the idiom the other gates use).
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    main();
  }
}
