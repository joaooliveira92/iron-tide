# ADR-0364: Worktree and git workflow

Consolidates: ADR-0220, ADR-0234, ADR-0236, ADR-0237, ADR-0269, ADR-0313

Applies to: repository

Rule: At most five worktrees including the main checkout; each on its own short-lived branch cut from `dev`; manage through `pnpm worktrees` which uses a locked JSON registry under the Git common directory; merge into `dev` locally after gates are green; one session per checkout.

## Status

Accepted (2026-10-30).

Supersedes: ADR-0220
Supersedes: ADR-0234
Supersedes: ADR-0236
Supersedes: ADR-0237
Supersedes: ADR-0269
Supersedes: ADR-0313

## Context

The project evolved through several worktree and git workflow models. ADR-0220 required every concurrent effort in its own worktree under `.worktrees/<slug>`, tracked in a Markdown ledger at `.ai/WORKTREES.md`. In practice worktrees multiplied to seventeen, several held work that never reached `dev`, and the running app was often started from a checkout that did not contain the merged code. ADR-0234 banned worktrees entirely and moved to a single checkout with local feature branches and optional PRs. A hard ban was stricter than needed — the failure was an unbounded count, not the existence of a second checkout. ADR-0236 reintroduced worktrees with a cap of three, ADR-0237 raised the cap to five.

The worktree ledger moved twice: ADR-0269 placed it at `.worktrees/LEDGER.md` (local and untracked, fixing divergent copies and dirty `dev` checkouts), then ADR-0313 replaced the hand-formatted Markdown table with a versioned JSON registry under `$(git rev-parse --git-common-dir)/ai/worktrees.json`, adding atomic writes, a serialising lock, and a fail-closed schema. The current state incorporates all three lessons: bounded count, machine-local registry, and lifecycle tooling.

## Rules

1. **Cap.** At most five total checkouts: the main checkout plus up to four extra worktrees under `.worktrees/<slug>`. `pnpm worktrees new` enforces the cap through `MAX_WORKTREES`. Raising the cap requires a new ADR.

2. **Branches.** Every worktree lives on its own short-lived branch (`feat/…`, `fix/…`, `chore/…`) cut from `dev`. Never commit directly on `dev` or `main`. Never share a checkout between sessions; uncommitted work is stashed or committed before switching.

3. **Lifecycle tooling.** `pnpm worktrees <create|list|audit|sync|prune|remove>` owns the lifecycle, implemented by `scripts/worktree.mjs`. Create, list, audit, sync and prune operate on the shared registry. `prune` refuses to delete a worktree with uncommitted changes without `--force` and never deletes an unmerged branch.

4. **Registry.** The worktree inventory is a versioned JSON registry at `$(git rev-parse --git-common-dir)/ai/worktrees.json`, shared by every linked worktree. Schema version 1 stores: `slug`, `branch`, `scope`, `owner`, `status`, `base`, `created`, `pr`, `path`. Rows are ordered by slug; unknown fields or schema versions are rejected.

5. **Atomicity and locking.** Writes replace the file atomically: write and fsync a temporary file in the same directory, then rename over the registry. A lock file beside the registry serialises read-modify-write commands. A lock older than the stale threshold is reclaimed; a lock held past the timeout fails the command with a typed error.

6. **Fail-closed.** A corrupt or unsupported registry fails closed. The tool reports the typed failure and never overwrites the file, so human metadata cannot be silently lost. Migrated rows from the legacy `.worktrees/LEDGER.md` are canonicalised; phantom records (rows without a worktree on disk) are dropped. The legacy Markdown file is no longer authoritative or rewritten.

7. **Delivery.** Merge the branch into `dev` locally once `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green on the branch. Pull requests are optional (ADR-0234). Delete a feature branch only after it is merged. No force-push, no history rewrite.

8. **Audit.** `pnpm worktrees audit` is a read-only inventory reconciling `git worktree list`, local and remote branches, the registry, and merged pull requests (including squash merges via `gh`). Drift (unregistered, outside, detached, phantom, branch-mismatched or stale worktrees; stale or `gone` orphan branches) exits 1. Open unmerged branches and dirtiness alone are not drift. The preflight gate (`scripts/verify-worktrees.mjs`) is warn-only; a blocking rule is not adopted because a correctness gate must not depend on machine-local untracked state.

9. **Local-only state.** Worktrees and the registry are machine-local and untracked. A fresh clone starts with an empty registry. `git worktree list` plus `pnpm worktrees sync` rebuilds it.