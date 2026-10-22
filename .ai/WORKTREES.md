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
| campaign-readouts | feat/campaign-readouts | campaign-readouts | unknown | active | dev | — | — |
| f1-spec | feat/f1-spec | f1-spec | unknown | active | dev | — | — |
| s5-go-live | feat/s5-10-go-live | s5-go-live | unknown | active | dev | — | — |
| domain-event-keys | feat/domain-event-keys | domain-event-keys | orchestrator | active | dev | 2026-10-22 | — |
<!-- worktrees:end -->
