# Agent tools

Deterministic, bounded commands, safe from any subdirectory. `agent:map` before reading, `verify:affected` before committing.

## `pnpm agent:map <symbol-or-path>`

Reports the owning workspace, the root and scoped `AGENTS.md`, public exports, the file's exported symbols, definition sites, bounded call sites, candidate tests, validation commands, current change state, and golden guidance. `--json` emits the same report as a stable object; `--limit` bounds lists (default 8).

Exit codes: `0` found, `2` usage, `3` ambiguous (candidates listed), `4` not found. It replaces a chain of `ls`, `sed`, `rg` and `git log` turns.

## `pnpm agent:status [--log <path>] [--base <ref>] [--no-pr]`

One block: branch, head, ahead/behind `dev`, dirty paths, the branch's PR with failed and pending checks, and with `--log` the last 40 lines of a gate log. Read-only; missing data is skipped. Use it instead of separate `git`, `gh` and `tail` turns. The Bash hook denies the fourth consecutive `tail`/`date`/`ps`/`sleep` poll on a log (`pollChainDenyAt`), subagents included.

## `pnpm verify:affected [--base <ref>] [--dry-run] [--verbose]`

Reads `pnpm change-scope --base <ref>` (default `dev`), maps changed paths to workspaces, adds reverse dependencies, and runs build, typecheck, tests and lint for each affected unit. Shared configuration, unowned paths and goldens widen the plan; `content/` adds every package's `test`. Work is serialised through the `heavy` lock, logs land in `node_modules/.cache/bluewave-verify/`, stdout is one line per unit. `--dry-run` prints the plan.

Exit codes: `0` clean, `1` failure, `2` usage or unknown base, `130` cancelled. It does not replace `pnpm check`.

## `pnpm sprint:show <selector>`

Prints one `.ai/SPRINT-PLAN.md` section, capped at 120 lines. `--list` shows the outline. Ambiguous selectors exit `3`, unknown `4`.

## `pnpm agent:map --screen [name]`

Lists renderer screens, or one screen's entry, routes, largest files, tests and e2e.

## `pnpm worktrees prune --check` and `merge <slug>`

Plain `prune` deletes merged subtrees: run `--check` first. `merge` dry-runs a clean `dev` merge; `--execute` performs it.

## `pnpm worktrees inbox`

Lists open tasks from the worktree registry, `NEEDS-YOU` rows first; `pnpm worktrees status <slug> <state>` moves one. See [task lifecycle](task-lifecycle.md).

## `pnpm dispatch:check <issue-number>...`

One line per issue (`CLEAR`, `STALE`, `CLAIMED`, `NEEDS-DECISION`) after a `DEV-GREEN|DEV-RED` and worktree-count header. Exit `0` only when all are `CLEAR` and dev is green, `2` otherwise (also `DISK-LOW`), `1` on tool errors.

## Long gates

Run long commands blocking through `pnpm heavy <command>`; it serialises across worktrees and forwards signals. Do not background a gate and poll it with `sleep`.

Quote shell separators (`printf '%s\n' '---'`); an unquoted `===` is a zsh glob that aborts the whole command. Discover paths with `git ls-files` before guessing one.

See [change scope](change-scope.md) for the report `verify:affected` consumes.
