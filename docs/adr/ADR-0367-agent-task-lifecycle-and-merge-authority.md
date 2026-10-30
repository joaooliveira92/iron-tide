# ADR-0367: Agent task lifecycle, merge authority and rollback

Applies to: repository

Rule: Every substantial agent task starts from a task brief that names its problem, evidence, acceptance criteria, validation, merge authority and blockers; runs in its own registered worktree and branch; moves through the lifecycle states tracked by `pnpm worktrees status`; returns to a human only at a lifecycle state marked as needing attention; merges only under explicit authority after gates and independent review pass; and ends with an execution report that carries rollback instructions.

## Status

Accepted (2026-10-30).

Amends: ADR-0364
Consistent with: ADR-0365

## Context

Agents here already work in bounded worktrees (ADR-0364) behind serialised gates (ADR-0365). Three gaps remained. Tasks were described by implementation instead of by problem, so agents built the prescribed fix rather than the simplest viable one. Agent threads had no lifecycle: finished, abandoned and waiting threads looked the same, and humans watched running work instead of reviewing finished work. Merge authority, rollback and provider-usage limits were implicit, so an agent's claim that work was complete stood in for repository evidence.

## Rules

1. **Task brief.** A task that changes more than one file or needs a gate run starts from `.ai/templates/task-brief.md`. The brief states the problem and evidence before any proposed solution. It names acceptance criteria, validation commands, expected artifacts, PR and merge authority, exact merge conditions, blockers and cleanup. Missing fields are filled before work starts, not inferred by the agent.

2. **Simplest viable solution first.** The agent inspects the repository and states the simplest viable solution before editing. When confidence is low, or the change is visual or gameplay-affecting, it returns alternatives (or a `pnpm snap` mockup) at `waiting-for-input` instead of implementing.

3. **One task, one branch, one worktree.** Each concurrent task runs in a worktree from `pnpm worktrees new <slug> --scope <issue>` on its own branch (ADR-0364). No unrelated change lands on a task branch. Review agents read the implementation branch from their own checkout, or from `git show`/`git diff` in a read-only checkout, and never mutate the implementation worktree.

4. **Lifecycle.** A task is in exactly one state: `queued`, `running`, `waiting-for-input`, `blocked`, `ready-for-review`, `ready-to-merge`, `monitoring-pr`, `merged`, `rejected`, `archived`. The registry `status` field records it through `pnpm worktrees status <slug> <state>`. `waiting-for-input`, `blocked`, `ready-for-review` and `ready-to-merge` need a human. `pnpm worktrees inbox` lists them first and hides closed states. The pre-lifecycle value `active` reads as `running`. This amends ADR-0364 rule 4 by fixing the vocabulary of `status`; the registry schema is unchanged.

5. **Verification over claims.** A report is a pointer, not evidence. The orchestrator or a human re-runs or inspects the gate output, the diff and `git status` before acting on a reported result. Before merge, the branch is rebased on its target and the full gate is re-run after the rebase and after every review fix.

6. **Independent review.** A change is high-risk when it touches authoritative engine behaviour, wire formats, saves, goldens, the desktop process boundary, dependencies, CI or release, or the gates themselves. A high-risk change gets a review from a second agent or a human against the original brief, using `.ai/REVIEW-PROMPT.md`. Findings are classified `required`, `recommended`, `invalid` or `unrelated`. Required findings are fixed. Rejected findings are answered with a reason. Unrelated findings become issues.

7. **Merge authority.** An agent merges only when the brief grants merge authority and every listed condition is machine-verifiable and observed green: preflight, scripts tests, check, required CI checks, a clean tree, a branch synchronised with the target, review disposition recorded and no unresolved required finding. Without that grant the agent stops at `ready-to-merge`. A release merge into `main`, publishing a release, and any action in the human-approval list in `docs/agents/autonomy-and-access.md` always need a human.

8. **Rollback.** Every delivery path has a documented rollback in `docs/agents/rollback.md`. Every execution report states the rollback for its change: a merge into `dev` is undone with `git revert -m 1 <merge>` on a fresh branch, never a history rewrite. Behaviour that may need to be switched off ships dormant (ADR-0365 rule 7) until the change that wires it.

9. **Execution report.** A task ends with the execution report in `.ai/templates/validation-report.md`. The report gives the outcome, changed files, exact commands and results, assumptions marked as facts or hypotheses, unresolved concerns, the PR or commit, the rollback and the recommended next action.

10. **Closure.** A merged, rejected or superseded task is set to its closed state and its worktree removed with `pnpm worktrees prune` or `remove`. Durable decisions go into ADRs, issues or reports, never only into an agent thread. Each working day ends with every task `running`, waiting on a dependency recorded in its brief, or closed.

11. **Provider usage.** Agents run only under accounts, plans and clients the provider's current terms permit for the workload. One identity per person or service. No account rotation, pooling, proxying, credential brokering or disguising of traffic to evade limits or detection. Cost is managed by budgets and context hygiene, never by cutting required verification.

## Consequences

- `scripts/worktree.mjs` gains `status`, `inbox` and `new --scope`. The lifecycle needs no schema migration.
- `.ai/templates/task-brief.md`, `docs/agents/task-lifecycle.md`, `docs/agents/rollback.md` and `docs/agents/autonomy-and-access.md` carry the operational detail. `.ai/REVIEW-PROMPT.md` and `.ai/templates/validation-report.md` gain the review classification and the execution-report fields.
- Machine provisioning, remote workers and a multi-machine dashboard are out of scope for this repository. `docs/agents/autonomy-and-access.md` states the baseline a worker must meet before it runs tasks here.
