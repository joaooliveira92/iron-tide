#!/usr/bin/env node
// Fail fast when the working tree is not in a clean, merge-free state.
//
// Two classes of breakage this catches in <1s instead of 30s into a build:
//   1. An in-progress git operation (merge/cherry-pick/rebase) — builds then die with
//      opaque errors (e.g. TS1185 conflict-marker errors) halfway through.
//   2. Conflict markers left in TRACKED files (including uncommitted ones) — same story.
//
// Wired into `pnpm dev` and `pnpm check`; safe to run standalone: `pnpm preflight`.
// See .agents/skills/resolving-merge-conflicts for the resolution workflow.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const problems = [];

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

// ---- 1. in-progress git operation ----
let gitDir = ".git";
try {
  gitDir = git(["rev-parse", "--git-dir"]).trim();
} catch {
  problems.push("not a git repository (or git unavailable)");
}

const stateFiles = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"];
const stateDirs = ["rebase-merge", "rebase-apply"];
for (const f of stateFiles) {
  if (fs.existsSync(path.join(root, gitDir, f))) {
    problems.push(
      `unresolved ${f.replace("_HEAD", "").toLowerCase()} in progress (${path.join(gitDir, f)} exists) — ` +
        `finish it (resolve every conflict, run the gate, commit); do not --abort mid-sprint ` +
        `(.agents/skills/resolving-merge-conflicts)`,
    );
  }
}
for (const d of stateDirs) {
  if (fs.existsSync(path.join(root, gitDir, d))) {
    problems.push(
      `rebase in progress (${path.join(gitDir, d)} exists) — finish or abort it before starting work`,
    );
  }
}

// ---- 2. conflict markers in tracked files ----
// Line-anchored: only the unambiguous bookends/diff3 marker, so setext underlines or
// prose containing "=======" cannot false-positive.
const MARKERS = "^(<<<<<<< |\\|\\|\\|\\|\\|\\|\\| |>>>>>>> )";
{
  try {
    const hits = git(["grep", "-n", "-I", "-E", MARKERS, "--", "."]);
    const lines = hits.split("\n").filter(Boolean);
    if (lines.length > 0) {
      const shown = lines.slice(0, 20);
      problems.push(
        `conflict markers in ${lines.length} tracked location(s):\n` +
          shown.map((l) => `      ${l}`).join("\n") +
          (lines.length > shown.length ? `\n      … ${lines.length - shown.length} more` : ""),
      );
    }
  } catch (err) {
    // git grep exits 1 when there are no matches; anything else is a real failure.
    if (err.status !== 1) {
      problems.push(
        `conflict-marker scan failed: ${(err.stderr || err.message || "").toString().trim()}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("preflight: FAILED\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nFix the state above, then re-run. (Marker leftovers: resolve the merge per");
  console.error(".agents/skills/resolving-merge-conflicts — never drop to `--abort` mid-sprint.)");
  process.exit(1);
}

console.log("preflight: ok (no in-progress git operation, no conflict markers in tracked files)");
