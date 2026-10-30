#!/usr/bin/env node
// Worktree hygiene gate. Warn-only, never fails preflight.
//
// A stale or unregistered worktree is a coordination smell — an agent may think
// a subtree is live when its branch is already merged, or two sessions may pick
// the same frontier. This surfaces the drift reported by `pnpm worktrees audit`
// so the nudge is visible in `pnpm preflight`, without blocking unrelated work (a
// correctness gate must not depend on shared git-worktree state, which is
// machine-local and untracked). It audits offline (no `gh`), so squash-merged
// branches are only caught by the full `pnpm worktrees audit`.
//
// Usage: `node scripts/verify-worktrees.mjs [--strict]`
//   --strict exits non-zero when drift exists (opt-in, for CI hygiene).
// Wired into `pnpm preflight` via `gate:worktrees`.

import { buildAudit, collectFacts } from "./worktree.mjs";

const strict = process.argv.includes("--strict");
const audit = buildAudit(collectFacts({ gh: false }));

if (audit.ok) {
  console.log(`worktrees: ok (${audit.ledger.length} registered)`);
  process.exit(0);
}

console.warn("worktrees: hygiene warnings (non-blocking)");
for (const d of audit.drift) console.warn(`  - ${d.code} ${d.subject}: ${d.detail} -> ${d.action}`);
console.warn("  run `pnpm worktrees audit` for the full inventory");
process.exit(strict ? 1 : 0);
