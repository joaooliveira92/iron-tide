#!/usr/bin/env node
// Worktree hygiene gate (ADR-0220). Warn-only, never fails preflight.
//
// A stale or unregistered worktree is a coordination smell — an agent may think
// a subtree is live when its branch is already merged, or two sessions may pick
// the same frontier. This surfaces the ledger drift and the prune backlog so the
// nudge is visible in `pnpm preflight`, without blocking unrelated work (a
// correctness gate must not depend on shared git-worktree state, which is
// machine-local and untracked).
//
// Usage: `node scripts/verify-worktrees.mjs [--strict]`
//   --strict exits non-zero when stale subtrees exist (opt-in, for CI hygiene).
// Wired into `pnpm preflight` via `gate:worktrees`.

import { existsSync } from "node:fs";
import { readLedger, inspectRows, unregisteredWorktrees, WORKTREES_DIR } from "./worktree.mjs";

const strict = process.argv.includes("--strict");
const registered = inspectRows(readLedger());
const unregistered = unregisteredWorktrees(readLedger());

const warnings = [];
for (const row of registered) {
  if (row.warnings.length > 0) warnings.push(`${row.slug}: ${row.warnings.join("; ")}`);
}
if (unregistered.length > 0) {
  warnings.push(
    `unregistered worktrees: ${unregistered.map((r) => r.slug).join(", ")} — run \`pnpm worktrees sync\``,
  );
}
if (!existsSync(WORKTREES_DIR) && registered.length === 0) {
  console.log("worktrees: ok (none registered)");
  process.exit(0);
}

if (warnings.length === 0) {
  console.log(`worktrees: ok (${registered.length} active)`);
  process.exit(0);
}

console.warn("worktrees: hygiene warnings (non-blocking)");
for (const w of warnings) console.warn(`  - ${w}`);
console.warn("  run `pnpm worktrees:prune` to remove merged/phantom subtrees");
process.exit(strict ? 1 : 0);
