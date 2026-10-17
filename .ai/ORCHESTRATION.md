# Bluewave Orchestration Pipeline

The orchestrator (the sprint/primary agent, launched by `.opencode/command/sprint.md`)
drives every sprint through four subagent roles plus an orchestrator-owned
validation gate. Subagents live in `.opencode/agents/`. The pipeline is
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
   `.scratch/` issue tracker, wire blocking edges, and work it one ticket per
   session. If the way is already clear and fits one session, skip straight to Spec.
2. **Ground (research)** — for content/spec-heavy sprints, the **research** role
   spins up a background agent against primary sources and writes
   `docs/research/<slug>-<topic>.md`.
3. **Spec (spec-creator)** — the **spec-creator** role synthesizes a spec in the
   **to-spec** format (Problem/Solution/User Stories/Implementation Decisions/
   Testing/Out of Scope), writes it to `.scratch/<slug>/spec.md`, and registers a
   pointer marking it ready for slicing (`.ai/specs/` is an index, not a store).
4. **Slice (to-tickets)** — once a spec is approved, **to-tickets** breaks it into
   **tracer-bullet vertical slices**, each declaring its blocking edges, published
   as `.scratch/<slug>/issues/<NN>-<name>.md` (frontier-ordered; blockers first).
5. **Execute (implementator)** — the **implementator** works the **frontier**
   (open, unblocked, `Frontier: yes`) tickets, one at a time, per
   ENGINEERING-CONTRACT.
6. **Verify (reviewer)** — the **reviewer** adversarial-checks each ticket/batch
   against its acceptance criteria + the spec + contract + repo standards.
7. **Gate + commit (orchestrator)** — orchestrator runs the validation gate, owns
   git/traceability/ADRs, and auto-advances.

## Roles

| Role              | `.opencode/agents/` | Skill                                     | Permissions         | Output                                                                  |
| ----------------- | ------------------- | ----------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| 1. spec-creator   | `spec-creator.md`   | `to-spec`                                 | write spec only     | `.scratch/<slug>/spec.md` + `.ai/specs/` pointer                        |
| 2. research       | `research.md`       | `research`                                | write notes only    | `docs/research/<slug>-<topic>.md`                                       |
| 3. implementator  | `implementator.md`  | — (works `to-tickets` output)             | edit+run            | frontier ticket done + code + tests + exact results + changed-file list |
| 4. reviewer       | `reviewer.md`       | —                                         | read-only           | severity-tagged findings + APPROVE / NEEDS_REWORK                       |
| orchestrator (me) | —                   | `wayfinder` (chart), `to-tickets` (slice) | owns git/validation | map + gate + git/traceability/ADRs                                      |

Ordering: **chart/research → spec → slice → implement → review → (repair loop) →
validation gate → commit**.

## Handoff contract

- Each subagent's final report is a **spec for the next step, not the source of
  truth**. The orchestrator re-reads files before editing and independently
  verifies claimed results.
- Write scope is role-locked: spec-creator writes only
  `.scratch/<slug>/spec.md` + its `.ai/specs/` pointer; research writes only
  `docs/research/<slug>-<topic>.md`; the reviewer writes nothing. The
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
- any authoritative hash changes get old/new + cause + migration assessment
  (ADR-0007 process). A build alone is not acceptance (ENGINEERING-CONTRACT §Tests).

## Concurrent worktrees

Run each effort in its own worktree (`.worktrees/<slug>`, ADR-0220) so several
orchestrators progress in parallel without sharing a checkout. Track the live set
in `.ai/WORKTREES.md` via `pnpm worktrees` (`new`/`list`/`sync`/`prune`);
`pnpm preflight` warns on stale or unregistered subtrees.

## Orchestrator responsibilities

- Pick the sprint from `.ai/SPRINT-PLAN.md`; optionally override with
  `$ARGUMENTS`; auto-advance per plan dependency order.
- For huge/foggy efforts, chart via **wayfinder** (`map.md` + decision tickets on
  `.scratch/`); otherwise go spec → slice → implement directly.
- Own all Git: small Conventional Commits on a short-lived branch (never
  directly on `dev`), delivered by a checks-green pull request; no self-merge of
  a release PR into `main`; leave the tree clean (ADR-0165).
- Update traceability (SPRINT-PLAN row done + pointer, PROGRESS.md, reports).
- Resolve routine decisions as ADRs; stop only on a genuine decision-request /
  stop condition.
- Keep the roles tiny and focused so no single subagent accumulates the whole
  project context.
