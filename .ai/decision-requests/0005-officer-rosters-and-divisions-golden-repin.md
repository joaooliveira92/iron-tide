# Decision Request: Authoritative command-structure change with no golden baseline

## Status

Resolved (2026-10-17) — owner approved **Option A** (implement N-1 ticket 07
with a same-commit golden re-pin). The golden-baseline precondition was already
resolved. See the owner decision below.

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

## Decision-ready packet (reconciled 2026-10-17)

**Status reframe.** The original blocker — no golden baseline — is **resolved**: the
baseline exists (`golden/hashes.json`, commit `0117adc`, `Golden-Repin:
baseline-created`), so the same-commit re-pin path is available. The remaining
question is owner approval of the behavioural change itself.

**Exact question requiring owner authority.** Approve landing N-1 ticket 07's
behavioural command-structure change — per-nation officer rosters
(`packages/campaign/src/officers.ts`) and seeded 1880 divisions (a new authored
collection plus `packages/campaign/src/nationCompilation.ts` wiring) — which moves the
cross-process golden reference hashes, re-pinned in the same commit?

**Affected scope.** N-1 ticket 07 (and N-1 completion); N-2/N-3 transitively;
`packages/campaign/src/{officers,nationCompilation,state}.ts`;
`content/production/1880/` (a new divisions collection); `golden/hashes.json`
(same-commit re-pin); the reference run `packages/cross-process-test/src/run-child.ts`;
the production-pack loop test. Acceptance: N-1's per-nation report and the reference
run re-pinned with an understood cause.

**Known constraints and invariants.** Determinism (identical hashes across OSes);
`scripts/verify-golden-repin.mjs` requires a same-commit re-pin with old/new/cause;
ADR-0213 permits authored opening-posture magnitudes as `provenance.kind:
balance_adjustment`; the manual grounds command structure but supplies no roster
magnitudes; compatibility-version policy on `NationState` changes.

**Options.** A — implement now, re-pin in the same commit (the original Option A,
now that the baseline exists). B — implement with a new gate trailer for pre-baseline
behavioural changes (no longer needed). C — the false `not-needed` trailer (rejected).

**Consequences.** _Gameplay:_ nations gain distinct officer rosters and initial
divisions (command and division assignment). _Determinism:_ reference hashes move,
with an understood cause; re-pinned in-commit. _Saves:_ `NationState` populates
`officers`/`divisions`; a compatibility bump may be required if required-ness
changes. _Wire:_ none. _Balance:_ roster/division magnitudes are balance choices
(ADR-0213). _Content:_ a new authored divisions collection. _Tests:_ re-pin the
reference golden and any pinned snapshot tests. _Migration:_ a prior-version save is
refused or migrated per policy.

**Recommendation.** Option A. The baseline now exists, so ticket 07 can land honestly
with a same-commit re-pin; magnitudes are authored as ADR-0213 balance choices unless
the owner supplies sourced values.

**Minimum owner response to unblock.** "Approve the N-1/07 officer-roster and
division change with a same-commit golden re-pin; magnitudes may be authored as
ADR-0213 balance choices" (or supply values / decline).

**Must not be guessed.** That the reference hashes move (they do); whether that
behavioural change is acceptable; the provenance of roster/division magnitudes.

## Owner decision (2026-10-17)

**Chosen:** Option A — approve implementation of N-1 ticket 07 with a
same-commit golden re-pin. Recorded in
[ADR-0224](../../docs/adr/ADR-0224-1880-command-structure-divisions-and-officers.md).

**Authorized production values or rules.** Implement the per-nation officer
rosters and seeded 1880 divisions. Roster and division magnitudes may be
authored as explicit ADR-0213 balance_adjustment values with provenance. Move
and re-pin the affected authoritative golden hashes in the same behavioral
commit, recording the old hash, new hash, and exact cause through the
established golden-repin mechanism.

**Additional constraints.** Preserve cross-platform determinism. Assess the
`NationState` compatibility-version impact explicitly and either implement a
deterministic migration or deliberately refuse incompatible prior saves
according to the repository's existing compatibility policy. Do not use the
`not-needed` trailer. Do not alter unrelated gameplay values.
