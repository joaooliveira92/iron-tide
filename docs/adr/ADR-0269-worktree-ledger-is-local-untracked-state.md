# ADR-0269: The worktree ledger is local, untracked state

Applies to: repository

## Status

Superseded by: ADR-0313. Amends ADR-0220.

## Context

ADR-0220 tracked the ledger at `.ai/WORKTREES.md`. Worktrees are machine-local
and untracked, yet every `pnpm worktrees new|sync|prune|remove` rewrote a tracked
file. That left `dev` permanently dirty (commits on `dev` are forbidden), and each
worktree held its own divergent copy that conflicted on merge.

## Decision

- The ledger lives at `.worktrees/LEDGER.md` under the main checkout, which is
  already git-ignored. `scripts/worktree.mjs` resolves the main checkout through
  `git rev-parse --git-common-dir`, so every worktree reads and writes one file.
- `.ai/WORKTREES.md` is removed. Usage documentation lives in
  `.opencode/command/worktrees.md`.
- Format, columns, and commands are unchanged. Humans still never edit it by hand.

## Consequences

- Registering a worktree no longer dirties any checkout or needs a commit.
- The ledger is no longer portable between machines; `git worktree list` plus
  `pnpm worktrees sync` rebuild it, and the preflight gate stays warn-only.
- A fresh clone starts with an empty ledger until `sync` runs.
