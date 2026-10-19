# ADR-0234: Single checkout with local feature branches merged to dev locally

## Status

Accepted (2026-10-19).

Supersedes: ADR-0220. It also replaces the worktree and pull-request delivery
parts of ADR-0165.

## Context

ADR-0220 put every concurrent effort in its own worktree. In practice the
worktrees multiplied (seventeen at once), several held work that never reached
`dev`, and the running app was often started from a checkout that did not
contain the merged code. The owner works alone in one checkout and wants to
keep features locally and merge them into `dev` locally.

## Decision

- Work in the single main checkout. Each feature lives on a short-lived local
  branch (`feat/…`, `fix/…`, `chore/…`) cut from `dev`.
- Do not create worktrees. `pnpm worktrees` and `.ai/WORKTREES.md` are retired
  from the workflow; the scripts may stay until they are removed separately.
- Deliver by merging the branch into `dev` locally (`git merge`), after
  `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the branch.
  A pull request is optional, not required.
- Never commit directly on `dev` or `main`: the branch-discipline pre-commit
  hook stays, and a local merge is not blocked by it. The incident behind it
  (ADR-0044) still applies to any second session sharing the checkout, so only
  one session edits the checkout at a time.
- Delete a feature branch only after it is merged into `dev`.

## Consequences

- One place to look for the code that runs; no stale subtrees to reconcile.
- Concurrent sessions must not share the checkout; uncommitted work is stashed
  or committed on its branch before switching.
- History is not rewritten and nothing is force-pushed.

Amended by: ADR-0236 (up to three concurrent worktrees).
Amended by: ADR-0237 (cap raised to five).
