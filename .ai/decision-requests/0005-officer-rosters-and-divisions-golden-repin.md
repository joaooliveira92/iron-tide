# Decision Request: Authoritative command-structure change with no golden baseline

## Status

Blocked pending owner decision.

## Trigger

N-1 ticket 07 ("Seed 1880 divisions and de-duplicate the officer roster") requires
two changes that alter the authoritative campaign snapshot:

1. `packages/campaign/src/officers.ts` — `buildOfficerRoster` currently returns the
   same shape for every nation (6 officers: 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL).
   Ticket 07 wants nation-appropriate, distinct rosters.
2. Seeding initial divisions — `packages/campaign/src/nationCompilation.ts` hardcodes
   `divisions: []`, so this needs a new authored collection plus compile wiring in
   the authoritative engine.

Both live in `packages/campaign/src`, which is authoritative source under the
golden-repin guard (`scripts/verify-golden-repin.mjs`). Unlike the content tickets
(05/06/08/09) and ticket 02, these changes are _behavioural for the reference run_:
unlike ticket 02 (the fixture declares no designs/catalog), the reference run
_does_ compile nations and hash their full `NationState`, which includes
`officers` and `divisions`.

## Evidence

- `packages/cross-process-test/src/run-child.ts` — the golden reference run; its
  `FIXTURE` declares `countries` (`uk`, `france`) and hashes
  `snapshotToHashable(...).nations` (the whole `NationState`).
- `packages/campaign/src/nationCompilation.ts:219-220` — every nation gets
  `divisions: []` and `officers: buildOfficerRoster(id)`.
- `packages/campaign/src/state.ts:451-464` — `NationState` carries `divisions` and
  optional `officers`, so both are inside the hashed surface.
- `scripts/verify-golden-repin.mjs` — requires a commit that edits authoritative
  `packages/*/src` to either touch `golden/hashes.json` in the same commit or carry
  a `Golden-Repin: not-needed` trailer asserting a _no-output_ change.
- `.ai/AUTHORITY-INDEX.md:64,87` — `golden/hashes.json` is generated-and-untracked
  and "created only after the plan's 1880 prerequisites" (Phase 1); `pnpm check`'s
  `check:golden` cannot run until then.
- `golden/` does not exist in this checkout, so a re-pin in the same commit is not
  possible.
- ADR-0213 records the opening-posture magnitudes as balance choices; ticket 07's
  division placements and roster shapes fall under it.

## Why agent judgment is insufficient

Writing `Golden-Repin: not-needed` here would assert something false: the change
_does_ move the reference run's output. AGENTS forbids weakening a gate to pass, so
the agent must not use the trailer dishonestly. The genuine alternatives change
authoritative outcomes or gate policy and need an owner decision:

## Options

### Option A: Defer ticket 07 to Phase 1 (after the golden baseline exists)

- Behavior: leave ticket 07 blocked now; implement officer rosters + divisions in
  Phase 1 when `golden/hashes.json` is first generated, re-pinning in the same
  commit.
- Advantages: honest; no gate change; determinism provable at implementation time.
- Risks: the 1880 start ships without a command structure until Phase 1.
- Compatibility impact: none now.
- Migration impact: none.
- Scope and effort: defer only.

### Option B: Implement now with a behavioural re-pin marker

- Behavior: change the guard to accept a second trailer (e.g.
  `Golden-Repin: baseline-pending` with a reason) for behavioural changes landed
  before the baseline exists, then implement ticket 07 under it; the Phase 1
  baseline absorbs the result.
- Advantages: completes ticket 07 now.
- Risks: touches a determinism gate (needs its own reviewed evidence/ADR); the
  reference-run output moves with no baseline to prove it.
- Compatibility impact: gate semantics change.
- Migration impact: none.
- Scope and effort: small gate change + ticket 07.

### Option C: Implement now under `not-needed` as-is

- Behavior: use the existing trailer for the behavioural change.
- Advantages: no gate change.
- Risks: the trailer's contract ("no-output change") is violated; the gate loses
  meaning.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: ticket 07 only.

## Recommendation

Option A. It is the only option that neither weakens the determinism gate nor
asserts something false. Ticket 07's officer-roster and division work should land
with the Phase 1 golden baseline, re-pinned in the same commit.

## Work safely completed while blocked

- N-1 tickets 01, 02, 03, 04, 05, 06, 08, 09 completed and committed (HEAD
  `f966c06`), each with a deterministic test; content lock refreshed throughout.
- ADR-0212 (initial-fleet tech legality) and ADR-0213 (opening posture as authored
  canon; magnitudes are balance choices) recorded and indexed.
- Ticket 07 left `blocked` with a pointer to this request; no engine code changed.
