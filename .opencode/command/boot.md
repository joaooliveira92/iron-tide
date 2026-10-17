---
description: Boot the Bluewave autonomous orchestrator from a fresh, zero-context session. Verifies repo state, loads the minimum operating context, and launches the current frontier sprint through the 4-role pipeline + validation gate. Pass an optional sprint id ($ARGUMENTS) to override the frontier.
agent: build
---

You are booting the Bluewave autonomous engineering agent (orchestrator) with no
prior context. Bring the orchestrator online, confirm the repository is in a
startable state, and launch the current frontier sprint.

## 1. Verify state (fast, before trusting anything)

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
4. `.ai/SPRINT-PLAN.md` — the backlog and the **Immediate next action** pointer
   (your starting sprint). If `$ARGUMENTS` names a sprint id, start there instead.
5. `.ai/AUTHORITY-INDEX.md` and `.ai/reports/*` — authority and acceptance status
   (`docs/PROGRESS.md`/`docs/OPEN-ISSUES.md` are unavailable; ADR-0210).
6. `README.md` — canonical spec (DESIGN-55 defines "complete").
7. The brief/spec for the sprint you are about to run (see SPRINT-PLAN /
   `.ai/briefs/` / the sprint's spec issue, per `docs/agents/issue-tracker.md`).

Re-read issues and files before editing; a subagent report is a spec, not the
source of truth. If this session was restarted mid-effort, re-read the spec issue
and its sub-issues to resume the frontier rather than beginning anew.

## 3. Execute

Run the full execution loop by following **`.opencode/command/sprint.md`** (the
single source of truth for the sprint loop): determine the starting sprint, run
the wayfinder → spec → slice → implement → review → **validation gate** → commit
→ auto-advance pipeline, and stop only on a documented stop condition. The
context you loaded in §2 and the state you verified in §1 satisfy sprint.md's
"load your operating context" step — do not re-read everything from scratch.

## Final message

Report: which sprint(s) you ran and outcome, commit hash(es), validation evidence
(exact commands + observed results), whether the next sprint is queued, and the
precise reason you stopped. Keep it concise.
