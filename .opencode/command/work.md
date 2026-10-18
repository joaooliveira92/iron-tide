---
description: Boot the Bluewave autonomous orchestrator against a specific effort. Pass a GitHub issue reference ($ARGUMENTS) — a wayfinder map issue or a spec issue number/URL; the orchestrator resolves that effort's frontier and works it one ticket at a time through the 4-role pipeline + validation gate, auto-advancing until no unblocked ticket remains.
agent: build
---

You are booting the Bluewave autonomous engineering agent (orchestrator) with no
prior context, **scoped to one effort** instead of the SPRINT-PLAN frontier. The
user passed a GitHub issue reference:

`$ARGUMENTS`

## 1. Resolve and verify the target (fast, before trusting anything)

- Parse `$ARGUMENTS` as a GitHub issue reference — a number (`42`), a URL, or a
  `#42`. If empty or unresolvable, stop and report exactly what is missing — do
  not guess.
- Read it: `gh issue view <n> --json number,title,body,labels,subIssues`, and
  fetch comments separately with `--json comments --jq '.comments[-3:]'` (read
  older ones only when resuming). It is the effort's **root issue**:
  - `wayfinder:map` → the effort is still being charted; its frontier is its
    **decision tickets** (see the tracker doc's Wayfinding section).
  - `ready-for-agent` → the effort's **spec issue**; its frontier is its
    **implementation sub-issues**.
- `git status` — clean working tree expected. If there are uncommitted changes,
  report them; do not overwrite. Confirm you are on `dev` (not `main`).
- `git fetch` + compare `HEAD` to `origin/dev`; pull if behind.
- If `.opencode/agents/` (spec-creator, research, implementator, reviewer) is not
  being used and you are only offered generic subagents, note that opencode
  likely needs a restart to load them, and proceed with generic-subagent
  emulation of the four roles.

## 2. Load minimal operating context

Load the operating context exactly as **`.opencode/command/boot.md` §3** specifies
(it is the canonical list), then add the effort's own context: the root issue body
(map or spec) and its open child/sub-issues, in dependency order.

Re-read issues and files before editing; a subagent report is a spec, not the
source of truth. If this session was restarted mid-effort, re-read the root issue
and its open children to resume the frontier rather than beginning anew.

## 3. Determine the frontier (this scopes the work)

- Run boot.md §2's single GraphQL scan and keep the issues whose `parent` is the
  root issue (or whose body says `Part of #<root>`): drop any with `blockedBy > 0`
  or an assignee; **first in dependency order wins**.
  - Decision tickets (`wayfinder:*` labels) are worked **one decision per
    session** (wayfinder rule): resolve it, comment the answer, close it, append a
    pointer to the map's Decisions-so-far, and stop.
  - Implementation sub-issues are worked one frontier ticket at a time.
- If the effort has no open frontier left, report it complete and stop.
- Do NOT touch other efforts' issues or the `.ai/SPRINT-PLAN.md` backlog unless a
  ticket explicitly names them. This command's scope is the one root issue the
  user passed.

## 4. Execute

Run the execution loop by following **`.opencode/command/sprint.md`** (the single
source of truth for the sprint loop) — but substitute this effort's frontier for
the plan's. That is: for each frontier ticket, run the implement → review →
**validation gate** → commit pipeline, then auto-advance to the next frontier
ticket in **this same effort** until none remains or a stop condition is hit. The
context you loaded in §2 and the state you verified in §1 satisfy the
context-loading step (boot.md §3) — do not re-read everything from scratch.

- Claim before working: `gh issue edit <n> --add-assignee @me`, so the frontier is
  accurate if the session restarts.
- On each completion: comment the ticket with what changed and the exact
  validation commands + observed results, `gh issue close <n>`, make clean
  Conventional Commits on `dev` per `.ai/AUTONOMOUS-AGENT.md`, and write the
  validation report per `.ai/templates/validation-report.md`.
- The orchestrator runs the mandatory validation gate itself before any commit:
  clean uncached build, `tsc -b`, lint, format, full tests, cross-process
  determinism + golden verify; record exact observed results.

## Stop

Stop (do not advance further) only when ANY of these holds — record it clearly in
your final message:

- the effort's frontier is empty (no open, unblocked, unassigned ticket) → the
  passed effort is complete;
- you hit an `.ai/AUTONOMOUS-AGENT.md` stop condition;
- you need to write a `.ai/templates/decision-request.md` (unresolvable ambiguity,
  missing high-authority content, out-of-scope expansion) and MUST NOT guess;
- the session budget is exhausted (name the next frontier ticket so the next run
  resumes);
- your tooling/credentials cannot continue (e.g. unable to commit or push).

Never weaken a test, silently resolve an `OPEN DECISION`, fabricate canonical
content, or stop for routine local design choices. Never widen scope beyond the
passed effort.

## Final message

Report: the root issue; which ticket(s) you ran and outcome, commit hash(es),
validation evidence (exact commands + observed results), whether unblocked tickets
remain in the effort, and the precise reason you stopped. Keep it concise.
