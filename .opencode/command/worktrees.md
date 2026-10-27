---
description: Manage concurrent-agent workflow subtrees. Provision a dedicated git worktree for an effort `<slug>`, list the active subtrees, and prune merged/stale ones. Pass a subcommand ($ARGUMENTS): `new <slug>`, `list`, `sync`, `prune`, `remove <slug>`, or `audit`.
agent: build
---

You are managing the Bluetide worktree subtrees that let several agents work at
once without sharing a checkout (ADR-0220). Each effort runs in its own git
worktree under `.worktrees/<slug>` on a short-lived branch; the live set is the
shared registry `$(git rev-parse --git-common-dir)/ai/worktrees.json` (untracked and shared by every checkout, ADR-0313). Never edit that file by hand —
[`scripts/worktree.mjs`](../scripts/worktree.mjs) owns it.

Interpret `$ARGUMENTS` as `worktree.mjs` argv and run it:

- `new <slug> [--branch <name>] [--base <ref>] [--owner <role>]` — create
  `.worktrees/<slug>` on a branch from `dev` and register it. Then work its
  frontier with `.opencode/command/work.md <root issue>`.
- `list [--json]` — live subtrees joined with the registry, with drift warnings.
- `sync` — reconcile the registry with actual git worktrees (`git worktree list`).
- `prune [--check|--force]` — **hygiene**: remove merged/gone/phantom subtrees and
  their registry rows, including live worktrees the registry does not know about.
  `--check` only reports. Refuses a dirty worktree without `--force`; never
  deletes an unmerged branch or a detached worktree.
- `remove <slug> [--force]` — remove one subtree (registered or not).
- `audit [--json] [--no-gh]` — **read-only** inventory of every worktree (inside or
  outside `.worktrees/`), local and remote branch, registry row and merged PR
  (via `gh`). Integration status (`merged`, `merged-by-PR`, `gone`,
  `open-unmerged`, `fresh`, `base`) is reported apart from cleanliness (`dirty`).
  Exit 0 = no drift, 1 = drift, 2 = error. Run it before deleting anything.
- `--help` prints usage. Unknown options exit 2 and change nothing.

Run `pnpm worktrees <args>` (or `node scripts/worktree.mjs <args>`). Report the
observed command output verbatim — do not summarise away warnings. If
`$ARGUMENTS` is empty, run `list` and report the active subtrees.

## Hygiene rule

Before starting new work, run `list` (or `pnpm worktrees:prune`); `pnpm
preflight` warns via `scripts/verify-worktrees.mjs` when a subtree is merged or
unregistered. Prune merged/gone/phantom subtrees promptly so the registry reflects
what is actually live. A phantom row (registry entry with no worktree on disk) or an
unregistered worktree is drift: fix it with `sync` or `prune`, never by editing the registry.

Stop and report if `new` fails because the slug, path, or branch already exists —
do not force over another agent's subtree; that is exactly the shared-checkout
hazard ADR-0165 removed.
