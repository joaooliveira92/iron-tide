#!/usr/bin/env node
// Same-commit golden re-pin guard.
//
// `verify-golden-hashes.cjs` proves the reference run matches `golden/hashes.json`.
// That catches a behavioural change that moves the reference hashes, but not a
// change to authoritative source that happens to leave the reference run's
// outputs untouched: the golden gate stays green while the engine drifts.
//
// This guard fails a commit that edits authoritative source without touching
// `golden/hashes.json` in the same commit. A genuine no-output change (a pure
// refactor, type-only edit, or comment) records that assertion explicitly with a
// `Golden-Repin: not-needed` trailer in the commit body, alongside a reason.
//
// What "authoritative" means here is scoped to what actually feeds the reference
// run, not a blanket "any packages/*/src or content/ change":
//
//   * The reference run is `packages/cross-process-test/src/run-child.ts`, which
//     `verify-golden-hashes.cjs` executes. It compiles an *in-code synthetic
//     fixture* and never reads authored content, so no `content/**` path can move
//     `golden/hashes.json` — authored content is exempt.
//   * The fixture declares only rulesets/countries/areas/routes/possessions/
//     ports/technologies/fleets/economies/constructions/diplomacy/research. It
//     declares no naval-profile or ship-building/design collection, so the
//     dock-record plumbing modules listed in `REFERENCE_RUN_INERT` are never
//     exercised and cannot move the hashes either.
//   * Everything else under `packages/<authoritative>/src` stays gated.
//
//   COMMIT_RANGE="origin/dev..HEAD" node scripts/verify-golden-repin.mjs
//   node scripts/verify-golden-repin.mjs --range HEAD~1..HEAD
//
// Defaults to the recorded ratchet baseline..HEAD. Merge commits are skipped. If
// the range cannot be resolved the check is skipped rather than failed (shallow
// checkout, new branch).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Packages whose compiled output can feed the golden reference run. */
export const AUTHORITATIVE_PACKAGES = [
  "contracts",
  "deterministic",
  "content-schema",
  "content-compiler",
  "campaign",
  "campaign-engine",
  "commands",
  "events",
  "persistence",
  "phase-engine",
  "random",
  "combat",
  "ship-design",
  "ai",
  "armament",
];

/**
 * Reviewed, reasoned exemptions from the golden-repin guard: paths that cannot
 * move `golden/hashes.json` because the reference run (run-child.ts) never
 * consumes them. Each entry is either a `path` (exact file) or a `prefix` (tree).
 * Adding to this list is a gate change and must cite its evidence.
 *
 * @type {{ path?: string, prefix?: string, reason: string }[]}
 */
export const REFERENCE_RUN_EXEMPTIONS = [
  {
    prefix: "content/",
    reason:
      "The reference run compiles an in-code synthetic fixture; no authored content is read, so content/ cannot move golden/hashes.json.",
  },
  {
    path: "packages/ship-design/src/dock.ts",
    reason:
      "Dock-record derivation; the reference fixture declares no naval profiles, so it is inert.",
  },
  {
    path: "packages/ship-design/src/nationCompleteness.ts",
    reason:
      "Naval-profile completeness check; the reference fixture declares no naval profiles, so it is inert.",
  },
  {
    path: "packages/ship-design/src/nationProfile.ts",
    reason:
      "Naval-profile resolution; the reference fixture declares no naval profiles, so it is inert.",
  },
  {
    path: "packages/campaign/src/state.ts",
    reason:
      "Carries the optional NationDockState type only; the reference fixture sets no dock, so serialization is unchanged.",
  },
  {
    path: "packages/content-schema/src/naval-profile.ts",
    reason:
      "Naval-profile schema; the reference fixture declares no naval profiles, so it is never parsed.",
  },
  {
    path: "packages/phase-engine/src/orderEligibility.ts",
    reason:
      "Dock order eligibility; the reference fixture orders no ship-building project through it.",
  },
  {
    path: "packages/phase-engine/src/snapshotClone.ts",
    reason:
      "Clones the optional dock field; the reference fixture has no dock, so the clone is a no-op.",
  },
];

const SOURCE_RE = new RegExp(
  `^packages/(?:${AUTHORITATIVE_PACKAGES.join("|")})/src/.*\\.(ts|tsx)$`,
);
const GOLDEN_PATH = "golden/hashes.json";
const TRAILER_RE = /^\s*Golden-Repin:\s*not-needed\b/im;

/**
 * @param {string} path
 * @returns {boolean} true when `path` is a reviewed reference-run exemption
 */
export function isReferenceRunExempt(path) {
  return REFERENCE_RUN_EXEMPTIONS.some((entry) =>
    entry.path ? path === entry.path : path.startsWith(entry.prefix),
  );
}

/**
 * @param {string} path
 * @returns {boolean} true when a change to `path` can move the golden reference run
 */
export function isAuthoritativeSource(path) {
  if (path === GOLDEN_PATH) return false;
  if (isReferenceRunExempt(path)) return false;
  // Only source, not tests/fixtures under the package.
  return SOURCE_RE.test(path);
}

/**
 * @param {string[]} paths - paths changed by one commit
 * @param {string} message - full commit message
 * @returns {boolean} true when the commit needs a golden re-pin
 */
export function commitNeedsRepin(paths, message) {
  if (TRAILER_RE.test(message)) return false;
  if (paths.includes(GOLDEN_PATH)) return false;
  return paths.some(isAuthoritativeSource);
}

/**
 * @param {{ hash: string, subject: string, message: string, paths: string[] }[]} commits
 * @returns {{ hash: string, subject: string, files: string[] }[]}
 */
export function collectProblems(commits) {
  const problems = [];
  for (const commit of commits) {
    const files = commit.paths.filter(isAuthoritativeSource);
    if (commitNeedsRepin(commit.paths, commit.message)) {
      problems.push({ hash: commit.hash, subject: commit.subject, files });
    }
  }
  return problems;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

export function readCommits(range) {
  const raw = git(["log", "--no-merges", "--format=%H%x00%s%x00%B%x00%x00", range]);
  const commits = [];
  for (const record of raw.split("\0\0")) {
    const trimmed = record.replace(/^[\0\n\r]+/, "");
    if (trimmed.trim() === "") continue;
    const [hash, subject, message] = trimmed.split("\0");
    if (!hash) continue;
    const paths = git(["show", "--name-only", "--format=", hash])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    commits.push({ hash, subject: subject ?? "", message: message ?? "", paths });
  }
  return commits;
}

function parseRange(argv) {
  const index = argv.indexOf("--range");
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  if (process.env.COMMIT_RANGE) return process.env.COMMIT_RANGE;
  // Ratchet: only commits after the recorded baseline are gated, so commits
  // that landed before this guard exists are grandfathered (not re-failed).
  try {
    const baseline = readFileSync(resolve(import.meta.dirname, "golden-repin.baseline"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));
    if (baseline) return `${baseline.split(/\s+/)[0]}..HEAD`;
  } catch {
    // no baseline recorded
  }
  return "HEAD~1..HEAD";
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const range = parseRange(process.argv.slice(2));
  let commits;
  try {
    commits = readCommits(range);
  } catch {
    console.log(`golden-repin check: range "${range}" is unavailable; skipping`);
    process.exit(0);
  }
  const problems = collectProblems(commits);
  if (problems.length > 0) {
    console.error(
      `golden-repin check: ${problems.length} commit(s) changed authoritative source without re-pinning ${GOLDEN_PATH}:`,
    );
    for (const problem of problems) {
      console.error(`  ${problem.hash.slice(0, 8)} ${problem.subject}`);
      for (const file of problem.files) console.error(`      ${file}`);
    }
    console.error(
      "Re-pin in the same commit (`node scripts/regenerate-golden-hashes.cjs`) or record `Golden-Repin: not-needed` with a reason in the commit body.",
    );
    process.exit(1);
  }
  console.log(`golden-repin check: ok (${commits.length} commit(s) in "${range}")`);
}
