# ADR-0237: Up to five concurrent worktrees

## Status

Accepted (2026-10-19).

Amends: ADR-0236. Only the cap changes, from three to five.

## Context

ADR-0236 capped worktrees at three, main checkout included. In practice two
long-running feature efforts plus a short polish or fix effort already fill the
cap, which forces retiring unmerged work or serialising independent efforts.
Five remains a bounded count, so the unbounded-growth failure behind ADR-0234
(seventeen stale worktrees) stays prevented.

## Decision

- At most five worktrees may exist at once, counting the main checkout: the main
  checkout plus up to four extra worktrees under `.worktrees/<slug>`.
- `pnpm worktrees new <slug>` enforces the cap through `MAX_WORKTREES`.
- Everything else in ADR-0236 is unchanged: one session per checkout, one
  short-lived branch per worktree cut from `dev`, local-merge delivery, and
  `pnpm worktrees:prune` once a branch is merged.

## Consequences

- Up to five efforts can run in parallel; each still needs its own dependency
  install and the running app must still be started from `dev`.
- Raising the cap again needs a new ADR, not a silent constant change.
