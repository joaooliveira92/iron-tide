# ADR-0313: The worktree inventory is a locked registry under the Git common directory

Applies to: repository

## Status

Superseded by: ADR-0364

Accepted (2026-10-26).

Amends ADR-0220.

## Context

ADR-0269 moved the worktree ledger out of the branch-relative tree to
`.worktrees/LEDGER.md` under the main checkout. That fixed divergent copies and
dirty `dev` checkouts, but left the inventory as a hand-formatted Markdown table.
Concurrent commands have no schema, no lock, and no atomic replacement: two
`worktrees new` calls can each read the old table and one registration is lost,
and a truncated write leaves the only record unreadable. The path helper also
kept `.worktrees/` relative to the checkout running the command, so a command
started inside a linked worktree could create nested worktrees instead of
registering into the shared directory.

## Decision

- The inventory is a versioned JSON registry at
  `$(git rev-parse --git-common-dir)/ai/worktrees.json`. The Git common
  directory is shared by every linked worktree, so the registry is one file for
  the repository.
- Schema version 1 stores the existing coordination fields plus a canonical,
  absolute worktree `path`: `slug`, `branch`, `scope`, `owner`, `status`, `base`,
  `created`, `pr`, `path`. Rows are ordered by slug and unknown fields or schema
  versions are rejected.
- Writes replace the file atomically: write and fsync a temporary file in the
  same directory, then rename over the registry. A lock file beside the registry
  serialises read-modify-write commands; a lock older than the stale threshold is
  removed, and a lock held past the timeout fails the command with a typed error.
- A corrupt or unsupported registry fails closed. The tool reports the typed
  failure and never overwrites the file, so human metadata cannot be silently
  lost.
- On first use without a registry, valid rows from `.worktrees/LEDGER.md` are
  migrated: paths are canonicalised and rows without a worktree on disk (phantom
  records) are dropped. The legacy Markdown file is left untouched and is no
  longer authoritative or rewritten.
- `.worktrees/` is resolved from the main checkout, not from the command's
  checkout, so `new`, `sync`, `prune` and `remove` from a linked worktree act on
  the same inventory.
- `audit` and the warn-only preflight gate read the registry without writing;
  only lifecycle commands migrate or mutate it.

## Consequences

- Multiple linked worktrees can register, reconcile and prune concurrently
  without losing rows or corrupting the inventory.
- Malformed registry data requires operator attention rather than an automatic
  reset; the failure names the file and the reason.
- The inventory remains machine-local and untracked, so it never dirties a
  branch and a fresh clone starts empty until `sync`.
- Game state, hashes and replay compatibility are unaffected; this is developer
  tooling only.
