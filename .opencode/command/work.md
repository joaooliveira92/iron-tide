---
description: Boot the Bluewave autonomous orchestrator against a specific ticket directory. Pass a `.scratch/<slug>` path ($ARGUMENTS, absolute or relative); the orchestrator resolves that directory's spec/map and works its frontier one ticket at a time through the 4-role pipeline + validation gate, auto-advancing until no unblocked ticket remains.
agent: build
---

You are booting the Bluewave autonomous engineering agent (orchestrator) with no
prior context, **scoped to one feature directory** instead of the SPRINT-PLAN
frontier. The user passed a path to a directory of tickets:

`$ARGUMENTS`

## 1. Resolve and verify the target (fast, before trusting anything)

- Parse `$ARGUMENTS` as the target path. It may be absolute
  (e.g. `/Users/joao/dev/bluewave-compiler/.scratch/shipbuilding-process`) or
  relative (e.g. `.scratch/maintainability-hardening`). Normalize both to the
  same `.scratch/<slug>` directory. If `$ARGUMENTS` is empty or does not resolve
  to an existing directory, stop and report exactly what is missing — do not
  guess a slug.
- Confirm the directory has `.scratch/<slug>/issues/` holding one file per
  ticket. If it is missing, stop and report.
- `git status` — clean working tree expected. If there are uncommitted changes,
  report them; do not overwrite. Confirm you are on `dev` (not `main`).
- `git fetch` + compare `HEAD` to `origin/dev`; pull if behind.
- If `.opencode/agents/` (spec-creator, research, implementator, reviewer) is not
  being used and you are only offered generic subagents, note that opencode
  likely needs a restart to load them, and proceed with generic-subagent
  emulation of the four roles.

## 2. Load minimal operating context

Read, in this order, before editing anything:

1. `.ai/AUTONOMOUS-AGENT.md` — authority, autonomy, stop conditions.
2. `.ai/ENGINEERING-CONTRACT.md` — the binding contract.
3. `.ai/ORCHESTRATION.md` — the pipeline (wayfinder → to-spec → to-tickets →
   research → implementator → reviewer → validation gate).
4. `docs/agents/issue-tracker.md` — the tracker convention and frontier rule.
5. **The target directory's own context**, in this order if present:
   `.scratch/<slug>/map.md` (wayfinder chart), `.scratch/<slug>/spec.md` (the
   source of acceptance criteria), then its `issues/`.
6. `.ai/AUTHORITY-INDEX.md` and `.ai/reports/*` — authority and acceptance status
   (`docs/PROGRESS.md`/`docs/OPEN-ISSUES.md` are unavailable; ADR-0210).

Re-read files before editing; a subagent report is a spec, not the source of
truth. If this session was restarted mid-effort, skim `.scratch/<slug>/spec.md`
and its `issues/` to resume the frontier rather than beginning anew.

## 3. Determine the frontier (this scopes the work)

- Scan `.scratch/<slug>/issues/` for the **frontier**: files that are open
  (not `resolved`), unblocked (every `Blocked by:` reference is `resolved`), and
  unclaimed; **first by number wins**.
  - Implementation tickets (`**Type:** implementation`) additionally require
    `**Status:** open` and `**Frontier:** yes`.
  - Decision tickets (`**Type:** decision`) are worked **one decision per
    session** (wayfinder rule): resolve it, record the answer under `## Answer`,
    set `Status: resolved`, append a pointer to `map.md`'s Decisions-so-far, and
    stop — do not batch further decisions in that session.
- If the directory has no `issues/` frontier left (all tickets `resolved`), report
  the directory complete and stop.
- Do NOT touch other `.scratch/<slug>/` directories or the `.ai/SPRINT-PLAN.md`
  backlog unless a ticket explicitly names them. This command's scope is the one
  directory the user passed.

## 4. Execute

Run the execution loop by following **`.opencode/command/sprint.md`** (the single
source of truth for the sprint loop) — but substitute this directory's frontier
for the plan's. That is: for each frontier ticket, run the implement → review →
**validation gate** → commit pipeline, then auto-advance to the next frontier
ticket in **this same `.scratch/<slug>/` directory** until none remains or a stop
condition is hit. The context you loaded in §2 and the state you verified in §1
satisfy sprint.md's "load your operating context" step — do not re-read
everything from scratch.

- Claim before working: set the ticket's `**Status:**` to `claimed` (implementation)
  or `claimed` (decision) and save, so the frontier is accurate if the session
  restarts.
- On each completion: mark the ticket `resolved` with a short `## Comments`
  entry (what changed, exact validation commands + observed results), make clean
  Conventional Commits on `dev` per `.ai/AUTONOMOUS-AGENT.md`, and write the
  validation report per `.ai/templates/validation-report.md`.
- The orchestrator runs the mandatory validation gate itself before any commit:
  clean uncached build, `tsc -b`, lint, format, full tests, cross-process
  determinism + golden verify; record exact observed results.

## Stop

Stop (do not advance further) only when ANY of these holds — record it clearly in
your final message:

- the directory's frontier is empty (every ticket `resolved` / no open unblocked
  ticket) → the passed effort is complete;
- you hit an `.ai/AUTONOMOUS-AGENT.md` stop condition;
- you need to write a `.ai/templates/decision-request.md` (unresolvable ambiguity,
  missing high-authority content, out-of-scope expansion) and MUST NOT guess;
- the session budget is exhausted (name the next frontier ticket so the next run
  resumes);
- your tooling/credentials cannot continue (e.g. unable to commit or push).

Never weaken a test, silently resolve an `OPEN DECISION`, fabricate canonical
content, or stop for routine local design choices. Never widen scope beyond the
passed directory.

## Final message

Report: the target directory; which ticket(s) you ran and outcome, commit
hash(es), validation evidence (exact commands + observed results), whether
unblocked tickets remain in the directory, and the precise reason you stopped.
Keep it concise.
