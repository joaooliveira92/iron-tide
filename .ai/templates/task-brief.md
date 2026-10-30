# Task brief: <outcome in one line>

Hand this to an agent in place of an implementation recipe (ADR-0367). Fill
every field; write `none` rather than leaving one blank. The agent returns only at
a state that needs a human (`waiting-for-input`, `blocked`, `ready-for-review`,
`ready-to-merge`) or when the task is closed.

```yaml
task:
  id: "#123"
  objective: "<observable outcome>"
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "fix/issue-123"
  worktree: ".worktrees/issue-123"
  machine: "<host the agent runs on>"
  thread: "<agent thread link>"
  model: "<model and client>"
  risk: "low | high"
  pull_request: null
  pr_authorized: false
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
```

## Problem

What the player or engineer sees going wrong, or the capability missing. Not
the fix.

## Evidence

Issue links, reproduction steps, logs, screenshots, failing commands, replay ids.

## Constraints and non-goals

Rules, ADRs and packages that bound the change; what must not change; deferred
systems the agent must not wire.

## Acceptance criteria

Observable, checkable statements. Each maps to a test or an artifact.

## Approach

`agent decides` (state the simplest viable solution, then implement) or
`propose first` (return alternatives or a `pnpm snap` mockup at
`waiting-for-input`). Use `propose first` when confidence is low or the change
affects gameplay or layout.

## Required tests

Regression tests that must fail before the fix and pass after; new behaviour tests.

## Expected artifacts

Report under `.ai/reports/`, `pnpm snap` screenshots, balance reports, PR link.

## Delivery authority

- Pull request: `may open after local gates pass` | `do not open`.
- Merge: `not authorized` | `authorized when: <every condition, machine-checkable>`.
  The default conditions are in ADR-0367 rule 7.
- High-risk (ADR-0367 rule 6): independent review required before `ready-to-merge`.

## Blockers that need a human

The permanent stop conditions in `AGENTS.md`, plus task-specific ones.

## Downstream work

Investigate, implement, test, run validation, open the PR if authorized, get a
review and fix findings, give a runnable preview (`pnpm snap` or `pnpm dev`),
supervise CI to a terminal state, merge only if authorized. See
[task lifecycle](../../docs/agents/task-lifecycle.md).

## Cleanup

Set the closed state with `pnpm worktrees status <slug> merged|rejected|archived`,
prune the worktree, file follow-up issues for unrelated findings, and close the
thread.
