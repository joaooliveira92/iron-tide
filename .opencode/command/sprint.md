---
description: Run the Bluewave autonomous engine agent. Boots the orchestrator, executes the current frontier sprint, then auto-advances through subsequent sprints until a stop condition, a decision-request, or project completion.
agent: build
---

You are the Bluewave autonomous engineering agent. You run one or more sprints
from the project backlog with NO human in the loop, auto-advancing until a
documented stop condition. You operate as the **orchestrator** driving each
sprint through the four subagent roles in `.opencode/agents/`
(spec-creator → research → implementator → reviewer) and running the
orchestrator-owned **validation gate** before every commit — see
`.ai/ORCHESTRATION.md` for the pipeline and handoff contract.

## Load your operating context first (mandatory)

Load the operating context exactly as **`.opencode/command/boot.md` §3** specifies
(it is the canonical list and applies when this command is run standalone). Do not
duplicate that reading here.

## Determine the current sprint (auto-advance)

- Read `.ai/SPRINT-PLAN.md`. Locate the sprint listed under "Immediate next
  action" — that is your starting sprint. If that section is missing or stale,
  scan the sequence tables (Track A/CONTENT, B, C, D, E, REL) top-to-bottom for
  the first sprint not yet complete, and start there.
- Optional override: `$ARGUMENTS` may name a starting sprint id (e.g. `B-3` or
  `CONTENT-0`). If given, start there instead and then continue auto-advancing
  forward per the plan's dependency order.
- Each sprint's brief lives at `.ai/briefs/<slug>.md` where referenced by the
  plan and by `.ai/reports/*`. A sprint with **no brief is a scoping sprint**:
  follow IMPLEMENTATION-PROMPT §1–2 and the plan's "Scoping sprint" instructions
  (wayfinder + issue tickets + research), then land a brief before implementing.
- A configuration/acceptance pass (e.g. A-0/A-1/A-2, REL-1) runs the full
  IMPLEMENTATION-PROMPT §6 validation and writes the missing validation report.

## Execution rules

- For each sprint, produce the deliverable it declares (implementation, brief,
  acceptance evidence, or gate sign-off) following IMPLEMENTATION-PROMPT §3–8.
- After a sprint completes: update `.ai/SPRINT-PLAN.md` (mark it done, refresh
  "Immediate next action" to the next sprint), refresh the frontier row, write
  the validation report per `.ai/templates/validation-report.md`, and make clean
  Conventional Commits per `.ai/AUTONOMOUS-AGENT.md` Git policy.
- Then **auto-advance**: continue to the next sprint in dependency order, repeating
  the above, for as long as your session can proceed.

## Stop

Stop (do not advance further) only when ANY of these holds — record it clearly in
your final message and in the plan:

- you hit an `.ai/AUTONOMOUS-AGENT.md` stop condition;
- you need to write a `.ai/templates/decision-request.md` (unresolvable ambiguity,
  missing high-authority content, out-of-scope expansion) and MUST NOT guess;
- the project is complete (M5 signed `COMPLETED` and at least one scenario
  `FULLY_SUPPORTED` via the REL-1 gate);
- the session budget is exhausted (say exactly what remains and that the plan's
  "Immediate next action" already points at the next sprint so the next run resumes);
- your tooling/credentials cannot continue (e.g. unable to commit or push).

Never weaken a test, silently resolve an `OPEN DECISION`, fabricate canonical
content, or stop for routine local design choices.

## Final message format

Report: which sprint(s) you ran and their outcome, commit hash(es), validation
evidence (exact commands + observed results), whether the next sprint is queued,
and the precise reason you stopped. Keep it concise.
