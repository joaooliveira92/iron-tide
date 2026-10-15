# Decision Request: Frontier sprint P-2 cannot start — required plan artifacts are absent from this checkout

## Status

Blocked pending owner decision.

## Trigger

`.ai/SPRINT-PLAN.md` §"Immediate next action" points at **P-2 (ship designer)** as
the current frontier (remaining: ticket 30 "sourced content values release gate",
then the P-2 acceptance gate). The artifacts required to run and gate that sprint
do not exist in this repository, and `git log --all` shows they never have:

- no `.ai/briefs/<slug>.md` (`.ai/briefs/` is empty);
- no `.scratch/ship-building/` spec or `issues/` (the P-2 effort's tickets);
- `docs/PROGRESS.md` and `docs/OPEN-ISSUES.md` — both are required reading per
  `.opencode/command/sprint.md` §"Load your operating context" — are absent;
- `golden/hashes.json` is absent, so the mandatory validation gate's golden-hash
  verify cannot run (`node scripts/verify-golden-hashes.cjs` → UNAVAILABLE);
- the governing design docs (`DESIGN-55`, `docs/rules/*`, `docs/domain/*`) and
  ~120 of the referenced ADRs are absent (only 3 ADR files are tracked).

Repository is reduced: **19 commits total**, no `dev` branch ever created, no
remote configured, no `origin`. Branch is `refactor/comment-prune-sweep-a`.

## Evidence

- `git status` — clean; branch `refactor/comment-prune-sweep-a` (not `dev`).
- `git remote -v` — empty. `git branch -a` — `master`, `refactor/comment-prune-sweep-a` only.
- `git log --all --oneline -- docs/PROGRESS.md docs/OPEN-ISSUES.md .scratch/ship-building .ai/briefs 'golden/**'` — all empty.
- `git rev-list --count --all` — 19.
- `pnpm preflight` — EXIT 0 (code-side gates green; content lock `8884200f…`, version 0.5.0).
- `.scratch/comment-pruning/` — the only present effort; tickets 01–06, 08–10 `resolved`,
  11 (decision) `resolved`, **07 `blocked`** (needs a design-level strict
  `DesignDraft`/`EditLog` decode + typed override merge + a new `effect`/`Schema`
  edge to `ship-design`). Its frontier is empty (no open unblocked ticket).

## Why agent judgment is insufficient

- Scoping/implementing P-2 without `DESIGN-55` and its governing rules docs would
  **fabricate canonical content**, a stop condition.
- The validation gate cannot be satisfied because determinism (golden hashes)
  **cannot be demonstrated** in this checkout, a stop condition.
- Closing comment-pruning ticket 07 requires an authoritative-boundary decode
  design decision plus golden verification, which is likewise unavailable here.

## Options

### Option A: Obtain the full Bluewave checkout, then resume P-2

- Restore/point the agent at the complete repository — `.ai/briefs/`, the
  `.scratch/ship-building/` spec + tickets, `docs/PROGRESS.md`,
  `docs/OPEN-ISSUES.md`, `golden/hashes.json`, `DESIGN-55` and the ADR corpus.
- Then run the P-2 sprint (ticket 30 → acceptance gate) per the plan.
- Advantages: preserves the plan's ordering and authority; deterministic gate runnable.
- Risks: none to canonical state; requires a correct checkout.
- Compatibility/migration impact: none.
- Scope/effort: provisioning only; P-2 as planned.

### Option B: Re-scope the frontier to the only present effort (comment-pruning ticket 07)

- Treat `.scratch/comment-pruning/` as the frontier and resolve ticket 07's design
  decision as an ADR, then gate.
- Advantages: works with what is present.
- Risks: ticket 07 is explicitly deferred as a design change; the golden gate is
  still unavailable, so its acceptance criterion cannot be proven; and it is not
  the sprint the plan's frontier names.
- Compatibility/migration impact: new `effect`/`Schema` boundary on `ship-design`.
- Scope/effort: a design ADR + boundary migration, ungated.

## Recommendation

Option A. Do not start P-2, and do not resolve ticket 07 by guesswork. Provide the
complete checkout (or confirm the intended frontier) before the agent advances.

## Work safely completed while blocked

- State verification (branch/remote/history), operating-context load, and a green
  `pnpm preflight`. No code, content, tests, or canonical artifacts were changed.
