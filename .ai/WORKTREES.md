# Active worktrees

The coordination ledger for concurrent agents (ADR-0220). Several orchestrator
sessions may run at once, each scoped to one `.scratch/<slug>` effort. Each runs
in its own git worktree under `.worktrees/<slug>` on a short-lived branch, so no
two sessions share a checkout (ADR-0165). The table below is the single source of
truth for which subtrees are live **right now**.

Manage it with [`scripts/worktree.mjs`](../scripts/worktree.mjs) (`pnpm worktrees
…`), never by hand:

- `pnpm worktrees new <slug>` — create a subtree and register it here.
- `pnpm worktrees` — list live subtrees joined with this ledger.
- `pnpm worktrees sync` — reconcile this ledger with actual git worktrees.
- `pnpm worktrees:prune` — **hygiene**: remove merged/gone/phantom subtrees and
  their rows. `pnpm preflight` warns (via
  [`verify-worktrees.mjs`](../scripts/verify-worktrees.mjs)) when pruning is due.

`Status` is `active`, `review`, or `done`; `prune` treats anything else as
stale. `Scope` is the effort directory; `Owner` names the agent/role driving it.
Direction lives in [`ROADMAP.md`](ROADMAP.md); the backlog in
[`SPRINT-PLAN.md`](SPRINT-PLAN.md).

<!-- worktrees:begin -->
| Slug | Branch | Scope | Owner | Status | Base | Created | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| u-3-formatting-boundary | feat/u-3-formatting-boundary | .scratch/u-3-formatting-boundary | orchestrator | active | dev | 2026-10-16 | — |
| u-4-options-screen | feat/u-4-options-screen | .scratch/u-4-options-screen | orchestrator | active | dev | 2026-10-16 | — |
| determinism-gate-hardening | feat/determinism-gate-hardening | .scratch/determinism-gate-hardening | orchestrator | active | dev | 2026-10-16 | — |
<!-- worktrees:end -->
