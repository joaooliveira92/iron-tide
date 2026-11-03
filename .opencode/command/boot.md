---
description: Boot the Bluewave autonomous orchestrator from a fresh, zero-context session. Verifies repo state, scans the GitHub issue tracker for the current frontier, loads the minimum operating context, and launches it through the 4-role pipeline + validation gate. Pass an optional sprint id or issue reference ($ARGUMENTS) to override the frontier.
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

## 2. Scan the GitHub issue tracker (the frontier source of truth)

Per `docs/agents/issue-tracker.md`, GitHub Issues is the single
tracker for external reports and pipeline artifacts. The frontier is a GitHub
query, not a directory scan:

- Resolve the repo from the remote (expect `joaooliveira92/iron-tide`) and confirm
  `gh auth status`. If `gh` is unauthenticated or unreachable, stop and report it.
- Scan in **one** GraphQL query — labels, assignees, blockers, parent, and
  sub-issue counts for every open issue (substitute the resolved owner/repo):
  ```
  gh api graphql -f owner=<owner> -f repo=<repo> -f query='query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ issues(states:OPEN,first:100){ nodes{ number title labels(first:10){nodes{name}} assignees(first:5){nodes{login}} issueDependenciesSummary{blockedBy} parent{number} subIssues(first:50){totalCount} } } } }' --jq '[.data.repository.issues.nodes[] | select(.labels.nodes | map(.name) | any(. == "ready-for-agent" or (. | startswith("wayfinder:")))) | {n:.number, t:.title, l:[.labels.nodes[].name], a:[.assignees.nodes[].login], blockedBy:.issueDependenciesSummary.blockedBy, parent:.parent.number, subs:.subIssues.totalCount}]'
  ```
- Classify the returned issues by label:
  - `wayfinder:map` → an effort still being charted; its frontier is its
    `wayfinder:*` child tickets.
  - `ready-for-agent` with sub-issues → a **spec issue**; its frontier is its
    implementation sub-issues.
  - `ready-for-agent` without sub-issues → a standalone frontier ticket.
  - no pipeline label → an external report; report it, do not start it unless the
    owner's `$ARGUMENTS` names it.
- Compute the frontier: drop any issue with `blockedBy > 0` or an assignee;
  **first in dependency order wins**. Report the frontier list and the top
  candidate.
- Read the selected issue with `gh issue view <n> --json number,title,body,labels`.
  Comments on spec issues can be large: fetch them separately with
  `--json comments --jq '.comments[-3:]'` and read older ones only when resuming.
- Reconcile the frontier against `.ai/SPRINT-PLAN.md`'s "Immediate next action":
  if the plan points at a sprint whose issues are absent, closed, or blocked, do
  not silently choose — report the drift, prefer the issue tracker,
  and refresh the plan's frontier section once the sprint lands.
- `$ARGUMENTS` overrides the frontier: a GitHub issue reference (`#119`, a URL,
  or a number) scopes the run to that effort like `/work`; a sprint id (e.g.
  `B-3`, `CONTENT-0`) selects that sprint from the plan. If it is empty or
  unresolvable, fall back to the frontier above.

## 3. Load minimal operating context

This is the **canonical reading list**; `.opencode/command/sprint.md` and
`.opencode/command/work.md` point here instead of repeating it. Read in this
order, and only what the selected work needs:

1. `.ai/AUTONOMOUS-AGENT.md` — authority, autonomy, stop conditions.
2. `.ai/ENGINEERING-CONTRACT.md` — the binding contract.
3. `.ai/ORCHESTRATION.md` — the pipeline (wayfinder → to-spec → to-tickets →
   research → implementator → reviewer → validation gate).
4. `.ai/IMPLEMENTATION-PROMPT.md` — the per-sprint procedure sprint.md relies on.
5. `.ai/SPRINT-PLAN.md` — read the **Frontier** / "Immediate next action" section
   first; that is the sprint pointer. Read the selected sprint's row and brief on
   demand, and the rest of the plan only when reconciling status or selecting a
   plan sprint.
6. `docs/agents/issue-tracker.md` — the tracker convention, frontier rule, and
   `gh` operations.
7. `.ai/AUTHORITY-INDEX.md` — the authority map.
8. `.ai/reports/` — **only** the latest `reconciliation-*.md` and the selected
   sprint's report. Never bulk-read the reports directory; grep or open others
   only on demand.
9. `README.md` — canonical spec (DESIGN-55 defines "complete").
10. The frontier you selected in §2, read in full: the spec/root issue body and
    its open children in dependency order, or the sprint brief/spec
    (`.ai/briefs/` / the sprint's spec issue). Re-read the issues before editing.

Re-read issues and files before editing; a subagent report is a spec, not the
source of truth. If this session was restarted mid-effort, re-read the spec issue
and its sub-issues to resume the frontier rather than beginning anew.

## 4. Execute

Run the full execution loop by following **`.opencode/command/sprint.md`** (the
single source of truth for the sprint loop): determine the starting sprint, run
the wayfinder → spec → slice → implement → review → **validation gate** → commit
→ auto-advance pipeline, and stop only on a documented stop condition. The
context you loaded in §3 and the state you verified in §1–2 satisfy sprint.md's
context-loading step (sprint.md defers to §3) — do not re-read from scratch.

- Claim the selected issue before working: `gh issue edit <n> --add-assignee @me`,
  so the frontier stays accurate if the session restarts.
- On each completion: comment the issue with what changed and the exact validation
  commands + observed results, `gh issue close <n>`, then make clean Conventional
  Commits per `.ai/AUTONOMOUS-AGENT.md`.
- Then auto-advance to the next unblocked, unassigned frontier issue, re-scanning
  after each close so newly unblocked work is picked up.

## Final message

Report: the issues scanned and the selected frontier; which sprint(s)/ticket(s)
you ran and outcome, commit hash(es), validation evidence (exact commands +
observed results), whether the next sprint is queued, and the precise reason you
stopped. Keep it concise.
