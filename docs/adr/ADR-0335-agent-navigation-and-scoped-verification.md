# ADR-0335: Agent navigation and scoped verification are repository tools

Applies to: repository

## Status

Superseded by: ADR-0365

Accepted (2026-10-29). Resolves the agent-session efficiency program (#381).

## Context

Raw transcripts from three days showed 4,160 model steps and 1.34B re-read prompt tokens for 157 commits: 999 steps were
read-only inspection, 413 were verification only, and 67% of OpenCode steps issued a single tool call. Each step pays for
the whole context again, so the cost driver is the number of turns, not the size of a file. Discovery and verification were
both improvised: agents chained `ls`, `sed`, `rg` and `git log`, and ran ad-hoc package commands several times over.

The repository already had the pieces: workspace manifests and `AGENTS.md` files, generated `docs/adr/by-scope` pages,
`change-scope.mjs`, and the `heavy` serialiser. What was missing was one bounded entry point for each loop.

## Decision

- `scripts/agent-map.mjs` reports the owning workspace, applicable instructions and by-scope rules, exports, definition
  sites, bounded call sites, candidate tests, validation commands, change state and golden guidance for a symbol or path.
  It prints bounded text or a stable JSON object, exits `3` on ambiguity instead of choosing a definition, and `4` when
  nothing matches.
- `scripts/verify-affected.mjs` consumes the `change-scope` report and runs build, typecheck, tests and lint for the
  changed workspaces plus their reverse dependencies. Shared root configuration and unowned paths widen to full scope;
  docs, scripts, content and goldens map to their own units. It acquires the `heavy` lock once, keeps full logs under
  `node_modules/.cache/bluewave-verify/`, prints one line per unit, and propagates cancellation. It is a fast inner loop,
  not a replacement for `pnpm check`.
- `scripts/sprint-show.mjs` returns one bounded `.ai/SPRINT-PLAN.md` section so the plan is read by section, not whole.
- The root `AGENTS.md` names the three commands and the blocking rule inside its existing word budget.

## Consequences

Discovery and verification cost fewer turns, and the change model is stated in one place instead of in each agent's head.
The verification planner is deliberately conservative: an unresolvable path costs a full-scope run rather than false
confidence. New workspaces and new root configuration are covered by the same discovery rules without a second registry.

## Compatibility

No product, state, hash or wire change. The commands are development tooling and run only at the repository boundary.
