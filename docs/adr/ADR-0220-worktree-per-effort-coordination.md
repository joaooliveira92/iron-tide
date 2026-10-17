# ADR-0220: Worktree-per-effort coordination for concurrent agents

## Status

Accepted (2026-10-16). Defines how several orchestrator sessions run at once
without sharing a checkout, extending the delivery rule of ADR-0165.

## Context

ADR-0165 already requires work to land on a short-lived branch in a dedicated
worktree, after two agents sharing one `dev` checkout let a `git add -A` sweep
each other's uncommitted files into a commit. Nothing, however, tracked *which*
subtrees were live: a second session could not tell whether an effort was
already claimed, finished, or abandoned, and abandoned worktrees and branches
accumulated silently. An autonomous agent reads the repository to decide what to
do, so that state must be truthful and cheap to reconcile.

## Decision

Each concurrent effort runs in its own git worktree under `.worktrees/<slug>`
(git-ignored) on a short-lived branch, scoped to one `.scratch/<slug>` effort and
one frontier. The live set is recorded in **`.ai/WORKTREES.md`**, a tracked
ledger between `<!-- worktrees:begin -->` / `<!-- worktrees:end -->` markers.

`scripts/worktree.mjs` (`pnpm worktrees …`) owns the lifecycle:
`new <slug>` registers a worktree; `list` joins the ledger with `git worktree
list`; `sync` reconciles drift; `prune` removes merged, gone, or phantom
subtrees and their rows. Hygiene is enforced by a **warn-only** preflight gate
(`scripts/verify-worktrees.mjs`, `gate:worktrees`) so coordination state never
blocks unrelated work: a correctness gate must not depend on machine-local,
untracked worktree state. `prune` refuses to delete a worktree with uncommitted
changes without `--force`, and never deletes an unmerged branch.

## Consequences

- Two sessions can run at once with no shared checkout; the incident class from
  ADR-0165 is structurally prevented, not just forbidden by policy.
- `.ai/WORKTREES.md` is a growing ledger, so it is deliberately outside the
  doc-budget manifest (like `PROGRESS.md` and the sprint plan).
- Merge detection is ancestry-based, so squash-merged PRs are not auto-pruned;
  those subtrees are removed explicitly with `worktrees remove <slug>`.
- Worktrees are machine-local and untracked; the ledger is the portable record.
