# Active worktrees

The coordination ledger for concurrent agents (ADR-0220). Several orchestrator
sessions may run at once, each scoped to one effort `<slug>` (a wayfinder map or
spec issue). Each runs
in its own git worktree under `.worktrees/<slug>` on a short-lived branch, so no
two sessions share a checkout (ADR-0165). The table below is the single source of
truth for which subtrees are live **right now**.

Manage it with [`scripts/worktree.mjs`](../scripts/worktree.mjs) (`pnpm worktrees
…`), never by hand:

- `pnpm worktrees new <slug>` — create a subtree and register it here.
- `pnpm worktrees` — list live subtrees joined with this ledger.
- `pnpm worktrees sync` — reconcile this ledger with actual git worktrees.
- `pnpm worktrees audit` — read-only inventory and drift report (worktrees,
  branches, remotes, ledger, merged PRs); exit 1 on drift.
- `pnpm worktrees:prune` — **hygiene**: remove merged/gone/phantom subtrees and
  their rows. `pnpm preflight` warns (via
  [`verify-worktrees.mjs`](../scripts/verify-worktrees.mjs)) when pruning is due.

`Status` is `active`, `review`, or `done`; `prune` treats anything else as
stale. `Scope` is the effort slug; `Owner` names the agent/role driving it.
Direction lives in [`ROADMAP.md`](ROADMAP.md); the backlog in
[`SPRINT-PLAN.md`](SPRINT-PLAN.md).

<!-- worktrees:begin -->
| Slug | Branch | Scope | Owner | Status | Base | Created | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work | dev | (primary dev checkout, not an effort) | user | active | dev | — | — |
| n-3-progression | feat/n-3-progression | n-3-progression | orchestrator | active | dev | 2026-10-17 | — |
| ship-designer-spec | feat/ship-designer-spec | ship-designer-spec | orchestrator | active | dev | 2026-10-18 | — |
| designer-parity-armour | feat/designer-parity-armour | designer-parity-armour | orchestrator | active | dev | 2026-10-18 | — |
| designer-parity-engine-priority | feat/designer-parity-engine-priority | designer-parity-engine-priority | orchestrator | active | feat/designer-parity-armour | 2026-10-18 | — |
| designer-parity-fire-control | feat/designer-parity-fire-control | designer-parity-fire-control | orchestrator | active | feat/designer-parity-engine-priority | 2026-10-18 | — |
| designer-parity-freeboard | feat/designer-parity-freeboard | designer-parity-freeboard | orchestrator | active | feat/designer-parity-fire-control | 2026-10-18 | — |
| designer-parity-tertiary | feat/designer-parity-tertiary | designer-parity-tertiary | orchestrator | active | feat/designer-parity-freeboard | 2026-10-18 | — |
| designer-parity-schemes | feat/designer-parity-schemes | designer-parity-schemes | orchestrator | active | feat/designer-parity-tertiary | 2026-10-18 | — |
| designer-parity-presentation | feat/designer-parity-presentation | designer-parity-presentation | orchestrator | active | feat/designer-parity-schemes | 2026-10-18 | — |
| designer-parity-values | feat/designer-parity-values | designer-parity-values | orchestrator | active | feat/designer-parity-presentation | 2026-10-18 | — |
<!-- worktrees:end -->
