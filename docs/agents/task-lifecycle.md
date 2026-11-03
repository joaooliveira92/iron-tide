# Agent task lifecycle

How an agent task runs from brief to closure. Start every
substantial task from [the task brief](../../.ai/templates/task-brief.md).

## States

| State | Meaning | Needs a human |
| --- | --- | --- |
| `queued` | Brief written, no agent started | no |
| `running` | Agent working | no |
| `waiting-for-input` | Agent asks a question or offers alternatives | yes |
| `blocked` | Stop condition or decision request open | yes |
| `ready-for-review` | Gates green, review or preview to look at | yes |
| `ready-to-merge` | Reviewed, gates green, no merge authority | yes |
| `monitoring-pr` | PR open, agent supervising CI and review | no |
| `merged` / `rejected` / `archived` | Closed | no |

```sh
pnpm worktrees new issue-123 --scope '#123' --branch fix/issue-123
pnpm worktrees status issue-123 monitoring-pr --pr '#401'
pnpm worktrees inbox            # NEEDS-YOU rows first; closed rows hidden
```

The inbox is the review queue. Do not watch running tasks. Open a thread
only when its row reads `NEEDS-YOU`. Run independent tasks at the same time,
within the worktree cap.

## Running

1. Inspect the repository (`pnpm agent:map`), then state the simplest viable
   solution. Follow existing patterns unless a deviation is justified in writing.
2. Mark every claim in the report as observed or a hypothesis. List assumptions.
3. Write a failing regression test, fix, and iterate on `pnpm verify:affected`.
4. Rebase on the target, then run the full gate once: `pnpm preflight`,
   `pnpm test:scripts`, `pnpm check`. UI changes need `pnpm snap` evidence.
5. Check the final diff for unrelated changes and a clean `git status`.

## Review

High-risk changes get an independent reviewer running
[the review prompt](../../.ai/REVIEW-PROMPT.md) against the brief and the full
diff. The reviewer is read-only and uses its own checkout or `git diff dev...<branch>`.
Classify every finding:

| Class | Action |
| --- | --- |
| `required` | Fix, then re-run the full gate |
| `recommended` | Fix if in scope, else file an issue |
| `invalid` | Reply with the evidence that refutes it |
| `unrelated` | File an issue; do not fix on this branch |

## Pull-request supervision

Open a PR only after local gates pass and the brief allows it. Then loop:

1. Wait for required checks to reach a terminal state, using an event-driven
   watcher (not a `sleep` loop).
2. Collect automated and human review comments; classify them as above.
3. Push fixes, re-run the gate, wait for CI again.
4. Stop at `blocked` when requirements conflict, CI is flaky beyond one re-run,
   or a finding would change scope.
5. When checks are green, the branch is synchronised and no required finding is
   open: merge if authorized, else set `ready-to-merge`.
6. After merge, confirm the merge commit is on `dev` and that the CI run on
   `dev` passes, then close the task.

## Closure and inbox zero

- Close merged, rejected and superseded tasks, and prune their worktrees.
- A task waiting on something outside the repository stays `blocked`, with the
  dependency and the date to revisit written in its brief or issue.
- Put decisions into `RULES.md`, issues or commit messages. Never leave them only in a thread.
- At the end of the day, run `pnpm worktrees inbox` and `pnpm worktrees audit`.
  Every row is running, blocked on a recorded dependency, or closed.

## Context and cost

- Keep one task in one session and one model. A model or machine change
  restarts from the brief plus the latest report.
- When a thread costs more to reload than to brief, write a handoff (`handoff`
  skill) and start a fresh thread.
- Record the model and client in the brief. Compare token and cache use with
  `.ai/reports/agent-efficiency-*` when a task is unexpectedly expensive.
- Never cut required tests or gates to save tokens. Measure the work by validated
  merges, not by threads started or tokens spent.
