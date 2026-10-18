# Remaining frontier work — S-1, N-1/07, and 0003-B research

You are a Bluewave engineering agent. This prompt is **self-contained**: it tells
you the current state, the authorized decisions, the exact remaining work, and
the gates. Read the authorities first, then execute lane by lane.

---

## 0. Repository and current state

- Monorepo: `/Users/joao/dev/iron-tide` (pnpm workspaces, strict TypeScript,
  Vite+, Electron). Package manager: pnpm.
- `dev` / `origin/dev` = **`efe15e5`** (includes the governance commit
  `2418b31` that recorded owner decisions 0003-B/0005-A/0006-B/0007-A and closed
  0008, plus ADR-0223/0224/0225).
- **Already done:** S-1 ticket 02 (maintenance charged by readiness state) on
  branch `feat/s1-readiness`, commit **`5b2a26e`**, delivered as **PR #23**
  (against `dev`). Worktree: `.worktrees/s1-readiness`.
- A **concurrent agent may be active** in the shared primary checkout. Do your
  work in your **own** worktree: `pnpm worktrees new <slug>` (then
  `pnpm install --frozen-lockfile` inside it and `pnpm build` before running
  tests). Never commit on `dev`/`main` (ADR-0165/0220).
- You may continue on `feat/s1-readiness` (to grow PR #23) or start a fresh
  short-lived branch off the latest `dev`. Rebase on `dev` before every push.

## 1. Read first (authority order)

1. `AGENTS.md` and `.ai/AUTONOMOUS-AGENT.md` — operating rules, autonomy, stop
   conditions.
2. `.ai/ENGINEERING-CONTRACT.md` — binding.
3. `.ai/ORCHESTRATION.md` — the pipeline (wayfinder → to-spec → to-tickets →
   research → implementator → reviewer → validation gate).
4. `.ai/SPRINT-PLAN.md` — the backlog; its **Frontier** section is your
   starting point.
5. `.ai/AUTHORITY-INDEX.md`, `README.md`, `RULES.md`.
6. `docs/adr/ADR-0223-*.md`, `ADR-0224-*.md`, `ADR-0225-*.md`, and `ADR-0213-*.md`.
7. `.ai/decision-requests/0003-*.md`, `0005-*.md`, `0006-*.md`, `0007-*.md`,
   `0008-*.md` — the recorded owner decisions (read the "Owner decision
   (2026-10-17)" sections).
8. `.scratch/s-1-readiness-and-maintenance/` (map, decisions D1–D7, spec,
   tickets 01–09) and `.scratch/n-1-1880-scenario-audit/issues/07-*.md`.

Re-read files before editing; a report is a spec, not the source of truth.

## 2. Authorized decisions — do NOT re-escalate these

- **0007-A (S-1 values).** Store every S-1 numeric gameplay value as a named,
  **centralized ruleset constant with provenance**; ground what can be grounded;
  any ungrounded magnitude may be selected only as an explicitly labelled
  ADR-0213 `balance_adjustment` (`sourceStatus: BALANCE_TARGET`), covered by
  deterministic tests and designed for later tuning. The pattern already landed
  is `packages/campaign/src/maintenance.ts` (formula + named multiplier
  constants, grounded vs balance_adjustment). **No numeric gameplay constant may
  be embedded directly in `economyPhases.ts`, `battlePhases.ts`,
  `opening-briefing`, `projection`, or `torpedoProjection.ts`.** Replace the
  hard-coded battle-readiness `80` through the centralized mechanism.
- **0005-A (N-1/07).** Approved: per-nation officer rosters + seeded 1880
  divisions, with a **same-commit golden re-pin**; roster/division magnitudes are
  ADR-0213 `balance_adjustment` values. Assess the `NationState`
  compatibility-version impact and either implement a deterministic migration or
  deliberately refuse incompatible prior saves. Do **not** use the `not-needed`
  trailer for this (it does move output).
- **0006-B (prestige).** Keep `NationState.prestige` **required with no engine
  default**; **S-2 stays blocked** until 0003 fully resolves. No placeholder,
  fixture-class, or otherwise unsourced prestige value in production content. Do
  not make the field optional/nullable/derived.
- **0003-B (prestige research).** Authorizes **research only**. Research the
  prestige scale/bounds, per-nation 1880 starts, loss fractions by source, gain
  magnitudes by source, monthly sacking probability, and the final-score rule
  against high-trust sources; record every adopted value with a citation in
  `docs/research/` and the required ADR; return every unresolved/contradictory
  value to the owner individually. Distinguish documented RTW3 behaviour from
  historical analogues, community observations, reverse-engineered observations,
  and Bluewave balance decisions. **No production prestige value may be
  committed until its provenance is explicit.**
- **0008** is closed administratively.

## 3. The frontier — process sequentially (lane isolation)

**S-1 and N-1 both move golden hashes. Do them one at a time so each golden
movement has exactly one attributable cause. Never bundle unrelated behavioural
changes into a single re-pin.**

Order (plan dependency order: Phase 1 before Phase 3):

1. **S-1 tickets 03–09** under 0007-A.
2. **N-1 ticket 07**, then N-1 completion and its dependent lanes (N-2, N-3).
3. **0003-B research** (non-production, parallel-safe with nothing that changes
   goldens).
4. **S-2 remains blocked** under 0006-B. Do not start it.
5. **0004** (mine inventory) is **not** on the frontier (its plan dependency
   W-1 → S-1/T-1 is unmet).

## 4. Per-lane instructions

### Lane 1 — S-1 readiness and maintenance (tickets 03–09)

Ticket 01 (readiness/crew state, compat bumped 2.0.0 → 3.0.0) and ticket 02
(maintenance by readiness) are **done**. Complete:

- **03 crew-quality ramp** — crew quality moves toward the state ceiling by a
  ruleset rate each month (no randomness); a working-up ship leaves working up at
  the "decent" threshold and is never returned to it; the step passes the phase
  registry guard. Add the ceilings/rate/threshold to the centralized constants.
- **04 repair state** — `REPAIR` is a state with a bounded remaining-months
  counter; charges ~2× active at the maintenance seam; mothballing halts the
  countdown and drops the premium; on release the ship returns to a normal state
  without losing crew. All domain events, no randomness.
- **05 wartime maintenance** — one ruleset multiplier applied to active-status
  maintenance when the nation is at war, read from existing war state; the phase
  footprint still passes the registry guard.
- **06 readiness gates battle** — replace `resolveReadiness: () => 80` and the
  neutral crew input with the real per-ship readiness/crew; key
  `SHIP_WORKING_UP_BATTLE_INELIGIBLE` off the real `WORKING_UP` state (not
  `isUnderConstruction`); exclude reserve/mothballed from ordinary battles; the
  surprise-attack exception is a named, tested seam; keep the existing
  `FUEL_BATTLE_INELIGIBLE` floor path. Gathering consumes no randomness.
- **07 readiness in projection** — `PlayerProjectionShip` carries readiness +
  crew quality; the projection reads `nation.maintenanceCost` (or both agree,
  asserted); the fleet screen shows the state; renderer/preload import no
  `effect`; presentation never changes a hash.
- **08 author production values** — record provenance for every centralized
  constant (grounded citation or `balance_adjustment`), re-pin goldens only if
  observable output changes.
- **09 S-1 acceptance** — a scripted 1880 production run exercises every S-1
  mechanic, two cross-process runs are byte-identical, and the validation report
  is written to `.ai/reports/` with the S-1 row marked done.

Grounded rules you must preserve (manual, authority 3): repair ≈ 2× active and
mothballing halts repair (p.51); mothballed = half maintenance (p.30); the
`AF`/`RF`/`MB`/`WU` states stay distinct; working-up ships do not fight (p.51).
Everything else (absolute active rate, reserve/mothballed/wartime multipliers,
crew ceilings/ramp, working-up threshold, battle readiness value) has **no manual
source** and is a balance choice.

### Lane 2 — N-1 ticket 07 (1880 command structure)

- Implement per-nation officer rosters (`packages/campaign/src/officers.ts`) and
  seeded 1880 divisions (a new authored collection + compile wiring in
  `packages/campaign/src/nationCompilation.ts`, which currently hard-codes
  `divisions: []`).
- Magnitudes are ADR-0213 `balance_adjustment` values.
- The reference run (`packages/cross-process-test/src/run-child.ts`) hashes the
  whole `NationState`, so this **moves the goldens**: re-pin `golden/hashes.json`
  **in the same commit** with old hash, new hash, and cause (ADR-0224,
  `docs/agents/golden-repinning.md`). Do not use `Golden-Repin: not-needed`.
- Assess the `NationState` compatibility impact; migrate deterministically or
  refuse prior saves.
- Then complete N-1 (the audit) and update traceability.

### Lane 3 — 0003-B prestige research (non-production)

- Run the `research` skill against high-trust primary sources; write
  `docs/research/<slug>-prestige-values.md` with per-value provenance and
  explicit provenance classes (documented RTW3 / historical analogue /
  community observation / reverse-engineered / Bluewave balance decision).
- Return unresolved or contradictory values to the owner (write a decision
  request). Do **not** author production prestige values; S-2 stays blocked.

## 5. Golden, compatibility, and determinism mechanics

- Golden guard: `scripts/verify-golden-repin.mjs` fails a commit that edits
  authoritative `packages/*/src` without either touching `golden/hashes.json` in
  the same commit or carrying a `Golden-Repin: not-needed` trailer (with a
  reason). For a genuine no-output change use the trailer; for a real output
  change re-pin with `node scripts/regenerate-golden-hashes.cjs` in the same
  commit.
- Verify with `pnpm check:golden` (must be 11/11 unless deliberately re-pinned)
  and `pnpm check:determinism` (two runs byte-identical).
- Determinism: no ambient time/random/locale/filesystem order; integer/fixed
  arithmetic with branded `SafeInt`; versioned canonical serialization. The
  runtime-free guard applies to `packages/messages/src` and the renderer/preload
  (no `effect` import there).

## 6. Definition of done / gates (run on the exact commit)

`pnpm preflight`, `pnpm test:scripts`, and `pnpm check` all green
(`pnpm check` = preflight, format, lint, lint:effect, test:scripts, licenses,
typecheck, build, content:verify, test:run, test:heavy, check:golden,
check:determinism, check:equivalence, check:golden-repin, check:balance-reports,
test:e2e). Clean tree; Conventional Commit subjects; each commit leaves the repo
valid. Deliver by a checks-green pull request into `dev`; do not self-merge.

## 7. Stop conditions (write a decision request, do not guess)

- A value cannot be grounded and cannot be responsibly classified/justified as an
  ADR-0213 `balance_adjustment` — return that individual value to the owner.
- Two plausible interpretations change gameplay; the design contradicts itself;
  required high-authority content is missing; a repair would fabricate canonical
  information; a golden hash changes without an understood authoritative cause;
  destructive operations or history rewriting would be required.
- Session budget exhausted — state exactly what remains; the `SPRINT-PLAN`
  Frontier already points at the next ticket.

## 8. Do not

- Start S-2, add prestige to production content, or alter `NationState` for S-2
  while 0003 is unresolved.
- Treat the 0003-B research authorization as authorization to adopt unsourced
  values.
- Weaken, skip, or regenerate a gate/fixture to pass.
- Commit on `dev`/`main`, force-push, or self-merge.
- Bundle unrelated behavioural changes into one golden re-pin.
