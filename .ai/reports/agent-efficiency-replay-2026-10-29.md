# Controlled replay: agent efficiency program (2026-10-29)

Status: complete pilot. The pre-registration above was written before either arm produced a result; the results below record what was measured, including the finding that neither arm used the new tools.

## Hypothesis

Given the same closed ticket, the same base commit, the same model and the same stop condition, the workflow that ships
`agent:map`, `verify:affected`, `sprint:show` and the corrected instructions completes with fewer model steps and fewer
prompt tokens, without a correctness or gate regression.

## Ticket

Issue #359, "Retry and surface failed draft autosave writes" (closed 2026-10-29). Selected because it is bounded, has
objective acceptance criteria, is covered by an automated test, needs no external service, and is representative of
ordinary work: one renderer hook, one warning component and tests. It is not a docs or tooling ticket, so the treatment
cannot win by reading fewer documents.

The executing sessions are fresh and have no memory of the original implementation. The operator (the session writing
this report) knows the original diff; that is recorded as a limitation.

## Base commit

`dev` already contains the ticket's implementation, and the first pilot attempt showed why that matters: the control
session ran `git show 2f872d2f` and recovered the original fix from repository history. That pilot is discarded
(see below).

The valid arms are worktrees of a fresh replay repository with no product history:

- `e866085` — one commit containing the tree of `fb0bb7ad` (`dev` at `62c09438` with the #359 implementation removed).
- Treatment adds `0c5106e` — the pre-fix tree plus only the tooling changes (agent tools + instructions).

`git log --all` in the replay repository shows only those commits. The original implementation commit, its message and its
diff are not reachable.

## Arms

| Arm       | Worktree            | Head      | Extra                      |
| --------- | ------------------- | --------- | -------------------------- |
| Control   | `replay2/control`   | `e866085` | none                       |
| Treatment | `replay2/treatment` | `0c5106e` | agent tools + instructions |

Both worktrees were `pnpm install --frozen-lockfile`-ed from the same lockfile before the runs, so dependency state and
warm caches are equal.

## Discarded attempts

- **History leak.** A control run in `.worktrees/replay-control` (based on `fb0bb7ad`) completed in 3.4 minutes with 14
  steps and 341k prompt tokens, but it reached the original diff through `git show 2f872d2f` and
  `git diff fb0bb7ad 88353d9b`. It measures history retrieval, not implementation, so it is excluded and kept only as
  evidence for the confounder.
- **Missing ticket text.** The first run in the clean repository was interrupted after a few seconds because the replay
  repository has no remote, so `gh issue view 359` could not resolve and the agent had no acceptance criteria. The
  prompt now embeds the ticket body and criteria for both arms.
- **Treatment overlay leak.** The first treatment tree overlaid the full tooling commit's tree, which also carried the
  #359 implementation from `dev`; the agent found the feature already present and only added a test. That run is
  discarded and the treatment tree was rebuilt from `fb0bb7ad` plus the tooling diff only (`0c5106e`).

## Constants

- Harness: OpenCode 2.2.1, local server, `build` agent, `openrouter/~deepseek/deepseek-flash-latest`.
- Prompt: byte-identical file for both arms (`replay-prompt.txt`), quoted below.
- Stop condition: the agent stops when it judges the acceptance criteria met; hard cap 30 minutes.
- No commits, no pushes, no branch changes, no edits to `AGENTS.md`, `.ai/`, `docs/adr/`, `scripts/`.
- Focused checks only; no `pnpm check`, E2E, snapshot, golden or full-repository gates.

Prompt (identical for both arms; the ticket text is embedded because the replay repository has no remote for `gh`):

> Work ticket #359 in this checkout: "Retry and surface failed draft autosave writes".
>
> What to build
>
> Draft autosave stops discarding work on a failed write. The latest draft value is re-queued and retried, including across further edits, and if saving still fails the player sees a persistent, dismissible warning that the draft is not saved. A later success clears the warning. The quit-time flush still sends any queued draft, and a draft that never saves is never reported as saved.
>
> Acceptance criteria
>
> - A rejected draft write no longer clears the pending value before the write succeeds.
> - Failed writes are retried, and a retry always sends the newest draft for that key (latest value wins).
> - Persistent failure shows a visible warning naming the draft as unsaved; the warning clears after a successful write.
> - Quit flush still sends a queued draft and does not report success for a failed write.
> - A test drives a failing write path and fails against the current silent-swallow behaviour.
>
> Read the repository instructions before editing. Implement the acceptance criteria in this checkout only.
>
> Constraints:
>
> - Do not commit, push, merge, or change branches.
> - Do not edit AGENTS.md, .ai/, docs/adr/, scripts/, or any repository tooling.
> - Run only focused checks for the files you change (for example the specific test file). Do not run pnpm check, E2E, snapshot, golden, or full-repository gates.
> - Stop when the acceptance criteria are met.
>
> At the end, report: files changed, the tests you ran and their result, and anything incomplete.

## Predefined thresholds

Fixed before the runs:

| Criterion                                | Adoption threshold                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Steps to green                           | treatment ≤ 75% of control                                                                                      |
| Prompt tokens (fresh input + cache read) | treatment ≤ 70% of control                                                                                      |
| Correctness                              | treatment passes the focused test and every acceptance criterion the operator can verify; no worse than control |
| Failed tool calls                        | treatment ≤ control + 5 percentage points                                                                       |
| Wall clock                               | treatment ≤ 120% of control                                                                                     |
| Gate weakening                           | none in either arm                                                                                              |

Regression conditions that block adoption regardless of speed: any acceptance criterion failing in treatment that passes
in control; any weakened test; any change outside the ticket's scope.

## Metrics

Collected from the raw OpenCode `part`/`session` rows for each session ID, plus wall clock measured by the driver:

- model steps (`step-finish` parts), tool calls by name and status;
- read-only, verification-only and wait/poll steps, by the same classifier used in the audit;
- failed calls, repeated file dumps, tool-output bytes;
- fresh input, cache-read, output tokens and cost;
- edits, files changed, focused test result, and acceptance-criteria completeness.

## Results

Both arms finished with `idleOutcome: succeeded`; neither produced a failed tool call.

| Metric                        | Control   | Treatment | Change |
| ----------------------------- | --------- | --------- | ------ |
| Model steps                   | 54        | 35        | -35%   |
| Tool calls                    | 73        | 55        | -25%   |
| Read-kind calls               | 34        | 35        | +3%    |
| Verify-kind calls             | 19        | 7         | -63%   |
| Mutate-kind calls             | 14        | 13        | -7%    |
| Wait/poll calls               | 0         | 0         | —      |
| Fresh input tokens            | 55,762    | 213,603   | +283%  |
| Cache-read tokens             | 2,784,896 | 1,517,312 | -46%   |
| Prompt tokens (fresh + cache) | 2,840,658 | 1,730,915 | -39%   |
| Output tokens                 | 12,942    | 1,287     | -90%   |
| Cost                          | $0.0424   | $0.0262   | -38%   |
| Mean context                  | 52,605    | 49,455    | -6%    |
| Peak context                  | 81,134    | 71,044    | -12%   |
| Wall clock                    | 6.3 min   | 5.1 min   | -19%   |
| Failed calls                  | 0         | 0         | —      |
| Files changed                 | 7         | 6         | -1     |
| Insertions                    | 188       | 212       | +13%   |
| Focused test                  | 8 passed  | 8 passed  | equal  |
| Calls to the new tools        | 0         | 0         | —      |

Raw values and session IDs: [agent-efficiency-replay-2026-10-29.metrics.json](agent-efficiency-replay-2026-10-29.metrics.json).
Transcripts remain in the local OpenCode store under those session IDs; they are machine-local and not committed.

## Thresholds

| Criterion        | Threshold             | Observed                          | Met       |
| ---------------- | --------------------- | --------------------------------- | --------- |
| Steps to green   | ≤ 75% of control      | 64.8%                             | yes       |
| Prompt tokens    | ≤ 70% of control      | 60.9%                             | yes       |
| Wall clock       | ≤ 120% of control     | 81%                               | yes       |
| Failed-call rate | ≤ control + 5 points  | 0 vs 0                            | yes       |
| Correctness      | no worse than control | both pass 8/8; one review finding | qualified |

## Decisive finding: the tools were not exercised

Neither session called `agent:map`, `verify:affected`, `sprint:show` or `heavy`. The measured difference therefore cannot
be attributed to the tools. It is the combined effect of the instruction change and run-to-run variance, and it is a
single run per arm. The tools remain **unmeasured**; only their correctness, not their efficiency, is established by
this program.

## Correctness review

Both arms meet the five acceptance criteria and both focused test files pass (8/8). Manual review found one difference:
control routes the warning text through `resolveMessage` and adds the key to `en-us-messages.ts`; treatment hardcodes
"Draft not saved" and its description in `DraftSaveWarning.tsx`, which the externalized-strings rule (ADR-0209) does not
allow. Lint does not catch it and the focused tests do not assert it, so it is a review finding rather than a test
failure. It is recorded against "correctness no worse than control".

## Decision

**Adopt the workflow, revise the claim, repeat the measurement.**

- Adopt: the tools and instruction rule meet the repository gates and the pilot meets every speed threshold with no test
  or ACS regression.
- Revise: do not claim that `agent:map` or `verify:affected` caused the reduction. A discovery-heavy task and an explicit
  instruction to use the map are required before that claim.
- Repeat: one run per arm, treatment ran second on a warmer machine, and the model never invoked the new tools. A second
  experiment with two repetitions and a symbol-level task (for example "move X from package A to B") is the next test.
- Do not treat the 85% audit projection as validated: this pilot measured 39% fewer prompt tokens on one task.

## Recommended next experiment

Same two-arm design, but the task must require cross-package discovery and the prompt must say "start with
`pnpm agent:map`". Measure tool calls to the map, discovery steps before the first edit, and verification steps to first
green. Two repetitions per arm.

## Confounders and limitations

- One run per arm: a pilot, not proof.
- The operator knows the original implementation; the executing sessions do not.
- Repository history is a separate leak: the discarded pilot recovered the fix with `git show`. The valid arms use a
  single-commit replay repository so no historical diff is reachable.
- The treatment branch carries the tooling commit, so a naive `verify:affected` against `dev` sees a full-scope diff.
  The prompt therefore asks for focused checks in both arms, and the report separates tool use from task work.
- Both arms share one machine; runs are sequential to reduce load interference.
- Cache warmth and network variability are not controlled beyond identical installs.
- The replay repository has one commit, so `git log`-based discovery behaves differently from the real repository. That
  removes an unfair shortcut but also removes a legitimate tool the agents normally have.
