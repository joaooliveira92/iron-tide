# Context efficiency

Sessions are limited by the 5-hour usage window, and cost grows with context length: every call re-reads the whole prefix. Keep threads short, read narrowly, and hand off at a boundary.

## Limits

All thresholds live in `scripts/data/agent-context-policy.json`; hooks, tests and the gate read that one file.

## Controls

| Control | Enforces | Where |
| --- | --- | --- |
| Bash guard | blocks `cat` above the line limit, `sed -i`, write-mode script heredocs, heredoc overwrite of existing files | `scripts/hooks/pre-tool-use-bash.mjs` |
| Context hook | advises at 100k, warns at 150k, blocks a resume or post-idle prompt above 200k | `scripts/hooks/user-prompt-context.mjs` |
| Snap defaults | 1280x800 window, CSS-pixel screenshots, `--full-res` opt-out | `pnpm snap` |
| Screen map | owners, tests and e2e per screen, generated from `git ls-files` | `pnpm agent:map --screen` |
| Gate | policy, hooks, templates, agents and docs stay coherent | `pnpm check:agent-context` |

Override a Bash block with `# agent-guard: allow <reason>` (logged to `~/.claude/tools/ctx-audit/guard-overrides.log`). Override a context block with `ctx-override: <reason>` in the prompt.

## Housekeeping

`pnpm worktrees merge <slug>` checks, without changing anything, that the worktree is clean, the main checkout is on `dev` with no tracked changes, no untracked file would be overwritten, and the merge has no conflicts. `--execute` then performs the `--no-ff` merge. Follow with `pnpm worktrees prune --check`; plain `prune` deletes, so read the check first.

## Session protocol

1. Start: read the handoff or brief, then `git status --short | head`, `pnpm agent:map`. Do not list the repo.
2. During: ranged reads, capped output, `Edit` for changes, subagents for sweeps over five files, `pnpm verify:affected` while iterating, one full gate on the final commit.
3. State: keep a state block of at most 12 lines (goal, branch, done, next, decisions, files, validation owed); rewrite it at milestones.
4. Hand off at the 150k warning, a usage-limit warning, or a finished slice: commit, fill the [handoff template](../../.ai/templates/handoff.md), put durable decisions in the brief or an issue, run `node scripts/verify-agent-context.mjs --handoff <file>`.
5. Resume from the handoff in a fresh session. Do not resume a thread above the block limit.
6. Stop only for a stop condition in [AGENTS.md](../../AGENTS.md). Call the advisor before 100k, not after.

## Measuring

`python3 ~/.claude/tools/ctx-audit/ctx_audit.py --hours 40` reports the audit KPIs from local transcripts; compare with the baseline in its README.
