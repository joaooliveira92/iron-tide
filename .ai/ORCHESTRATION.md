# Bluewave Orchestration Pipeline

This pipeline is **T2** (multi-session or foggy work, see
[AGENTS.md](../AGENTS.md#agent-workflow)); T0 and T1 tasks skip it and use the
Delivery path directly. The orchestrator (the primary agent session) drives every
sprint through four subagent roles plus an orchestrator-owned validation gate. Each role is
dispatched with a [task brief](templates/task-brief.md) and tracked through the
[task lifecycle](../docs/agents/task-lifecycle.md). The pipeline is
**ticket-driven** and built on four repo skills:

| Skill        | Where                       | Phase                                                   |
| ------------ | --------------------------- | ------------------------------------------------------- |
| `wayfinder`  | `.agents/skills/wayfinder`  | **chart** (huge/foggy efforts → map + decision tickets) |
| `to-spec`    | `.agents/skills/to-spec`    | **spec** (conversation → spec, ready for slicing)       |
| `to-tickets` | `.agents/skills/to-tickets` | **slice** (spec → vertical implementation tickets)      |
| `research`   | `.agents/skills/research`   | **ground** (source-grounded notes)                      |

> These skills' `disable-model-invocation: true` is ignored: the orchestrator and
> roles invoke them by name through the `skill` tool regardless.

## Phases

1. **Chart (wayfinder)** — when an effort spans more than one session or the way
   is foggy, run **wayfinder**: name the destination, map the frontier, create a
   `map.md` + decision tickets (`research`/`prototype`/`grilling`/`task`) on the
   GitHub issue tracker, wire blocking edges, and work it one ticket per
   session. If the way is already clear and fits one session, skip straight to Spec.
2. **Ground (research)** — for content/spec-heavy sprints, the **research** role
   spins up a background agent against primary sources and publishes a
   `Research` discussion.
3. **Spec (spec-creator)** — the **spec-creator** role synthesizes a spec in the
   **to-spec** format (Problem/Solution/User Stories/Implementation Decisions/
   Testing/Out of Scope), publishes it as a GitHub issue labelled `ready-for-agent`,
   and records its number for slicing.
4. **Slice (to-tickets)** — once a spec is approved, **to-tickets** breaks it into
   **tracer-bullet vertical slices**, each declaring its blocking edges, published
   as **sub-issues** of the spec issue (frontier-ordered; blockers first).
5. **Execute (implementator)** — the **implementator** works the **frontier**
   (open, unblocked, `Frontier: yes`) tickets, one at a time, per
   ENGINEERING-CONTRACT.
6. **Verify (reviewer)** — the **reviewer** adversarial-checks each ticket/batch
   against its acceptance criteria + the spec + contract + repo standards.
7. **Gate + commit (orchestrator)** — orchestrator runs the validation gate, owns
   git/traceability, and auto-advances.

## Roles

| Role             | Skill                                     | Permissions         | Output                                                        |
| ---------------- | ----------------------------------------- | ------------------- | ------------------------------------------------------------- |
| 1. spec-creator  | `to-spec`                                 | write spec issue    | spec issue (`ready-for-agent`)                                |
| 2. research      | `research`                                | write notes only    | `Research` discussion                                         |
| 3. implementator | — (works `to-tickets` output)             | edit+run            | frontier ticket + code + tests + execution report             |
| 4. reviewer      | — (`.ai/REVIEW-PROMPT.md`)                | read-only           | classified, severity-tagged findings + APPROVE / NEEDS_REWORK |
| orchestrator     | `wayfinder` (chart), `to-tickets` (slice) | owns git/validation | map + gate + git/traceability                                 |

Ordering: **chart/research → spec → slice → implement → review → (repair loop) →
validation gate → commit**.

## Handoff contract

- Each subagent's final report is a **spec for the next step, not the source of
  truth**. The orchestrator re-reads files, the diff and `git status`, and
  re-runs claimed gates before acting.
- Write scope is role-locked: spec-creator writes only the spec issue;
  research writes only a `Research` discussion; the reviewer writes nothing. The
  orchestrator re-reads those files (not the reports) before acting on them.
- The implementator works one **frontier ticket** (from to-tickets); the reviewer
  checks that ticket against its acceptance criteria + the spec + contract.
- On `NEEDS_REWORK` (blocker/high), the orchestrator sends the implementator back
  to repair that ticket, then re-reviews — never merging a failing review.
- One decision ticket per session (wayfinder rule); multiple small implementation
  tickets can close in one session only when each passes the gate.

## Orchestrator-owned validation gate (mandatory, before any commit)

The orchestrator runs the full gate itself and records exact observed results in
the sprint's validation report (`.ai/reports/<slug>.md`):

- clean uncached build (`vp run -r build --no-cache`);
- `tsc -b`, `pnpm lint`, `pnpm format`;
- full test suite;
- determinism: cross-process child run twice (byte-identical) + golden verify
  (`node scripts/verify-golden-hashes.cjs`);
- any authoritative hash changes get old/new + cause + migration assessment. A build alone is not acceptance (ENGINEERING-CONTRACT §Tests).

## Concurrent worktrees

Run each effort in its own worktree (`pnpm worktrees new <slug> --scope <issue>`)
so tasks progress in parallel without sharing a checkout. Set each
task's state with `pnpm worktrees status`, and review only what
`pnpm worktrees inbox` marks `NEEDS-YOU`. Do not watch running tasks.

## Dispatch

Before each delegation:

- **Dev green**: the latest `dev` run is green, else fix `dev` first or give the worker the known failures to exclude.
- **Live target**: the issue is open and no merged PR or `git log origin/dev --grep '#N'` commit fixes it. A claim is an open PR or a `pnpm worktrees status` scope; skip claimed issues.
- **Viable**: a read-only `search` pass confirms the acceptance criteria fit the code. A decision-needed issue goes to the user, not a worker.
- **Sized**: one slice fits about 100k tokens of worker context, else slice it (`to-tickets`) or give final gates to `runner`.
- **Routed**: Haiku for copy, single-file changes and narrow follow-ups on an existing PR; Sonnet for state shape, content, replays, explanation coverage or more than about 5 files.

The brief holds the issue number, acceptance criteria, likely files and the report format; it links AGENTS.md instead of restating it. Gates start in the background and the worker blocks on `t3_background_wait`; it never ends a turn with one pending or sleeps.

A report not starting `READY`, `DRAFT`, `BLOCKED` or `DONE` is non-terminal: do not re-delegate on it.

## Orchestrator responsibilities

- Pick the sprint from `.ai/SPRINT-PLAN.md`; optionally override with
  `$ARGUMENTS`; auto-advance per plan dependency order.
- For huge/foggy efforts, chart via **wayfinder** (`map` + decision tickets on
  GitHub Issues); otherwise go spec → slice → implement directly.
- Own all Git through the [Delivery path](../AGENTS.md#delivery): a draft PR into
  `dev` from the first push; merge only under the brief's merge authority; never into `main`; leave the tree clean.
- Close each task (merged/rejected/archived), prune its worktree, and record the
  rollback in its report.
- Update traceability (SPRINT-PLAN row done + pointer, `.ai/reports/*`).
- Run `pnpm dispatch:check <issues>` before every delegation; delegate only on exit 0.
- Resolve routine decisions locally; stop only on a stop condition.
