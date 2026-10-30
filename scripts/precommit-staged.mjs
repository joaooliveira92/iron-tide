#!/usr/bin/env node
// Fast staged-file format check for the `pre-commit` hook.
//
// The hook's `preflight` set checks git state, docs, dependency and determinism
// guards but never ran a formatter, so unformatted files kept landing and were
// only caught later by `pnpm check`/CI. This checks only the files staged for the
// pending commit, so it stays fast. Markdown/YAML/JSON are included only when
// Oxfmt is configured to handle them (it decides; unmatched paths are ignored).
//
// Bypass a deliberate exception with `git commit --no-verify`; CI re-runs
// `pnpm format` over the whole tree regardless.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

// Resolve the formatter without depending on the package manager being on PATH:
// git can run the hook from a GUI or non-login shell whose PATH lacks `pnpm`
// even while it has `node`. Prefer the workspace-installed vite-plus entry point
// and run it under the running node; only fall back to `vp` on PATH.
function formatter() {
  const entry = join(root, "node_modules", "vite-plus", "bin", "vp");
  if (existsSync(entry)) return { command: process.execPath, args: [entry] };
  return { command: "vp", args: [] };
}

function stagedFiles() {
  const out = execFileSync(
    "git",
    ["-C", root, "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--"],
    { encoding: "utf8" },
  );
  return out
    .split("\0")
    .map((path) => path.trim())
    .filter((path) => path !== "" && !path.endsWith(".png") && !path.endsWith(".ico"));
}

// A merge/rebase commit has no meaningful staged set to format-check.
try {
  execFileSync("git", ["-C", root, "rev-parse", "-q", "--verify", "MERGE_HEAD"], {
    stdio: "ignore",
  });
  console.log("precommit format: merge in progress; skipping staged format check");
  process.exit(0);
} catch {
  // no merge in progress
}

const files = stagedFiles();
if (files.length === 0) {
  console.log("precommit format: no staged files; skipping");
  process.exit(0);
}

const { command, args } = formatter();
try {
  execFileSync(command, [...args, "fmt", "--check", "--no-error-on-unmatched-pattern", ...files], {
    cwd: root,
    stdio: "inherit",
  });
} catch (error) {
  // A formatter that could not be spawned (missing binary, permissions) is a
  // setup problem, not unformatted code: never reject a valid commit with the
  // misleading "not formatted" message. `status === null` marks a spawn failure;
  // a run that exited non-zero means the check actually found unformatted files.
  if (error && error.status === null) {
    console.error(
      `precommit format: could not run the formatter (\`${command} ${args.join(" ")}\`); is the workspace installed? Run \`pnpm install\`.`,
    );
    process.exit(1);
  }
  console.error(
    "precommit format: staged files are not formatted. Run `pnpm format:fix` (or `git commit --no-verify` if intentional).",
  );
  process.exit(1);
}
console.log(`precommit format: ok (${files.length} staged file(s))`);
