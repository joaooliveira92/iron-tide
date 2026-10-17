# Validation report: S-1 ship readiness and maintenance

Status: **accepted** as of `feat/s1-readiness` (off `dev` @ `efe15e5`). S-1's
structural tickets 03–09 are complete and green. Ticket 01 (per-ship readiness and
crew state; compatibility 2.0.0 → 3.0.0) and ticket 02 (maintenance by readiness)
landed earlier and are in `dev`/PR #23.

## What landed

| Ticket                                         | State | Evidence                                                                                                                                                                                    |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03 crew-quality ramp                           | done  | `packages/phase-engine/src/readinessEvolution.ts` (inside the maintenance footprint), constants in `packages/campaign/src/readiness.ts`; `readiness-evolution.test.ts`, `readiness.test.ts` |
| 04 repair state + ×2 premium + mothball halt   | done  | `REPAIR` countdown in `readinessEvolution.ts`, `repairMonthsRemaining` on `Ship`; `readiness-evolution.test.ts` (tickets 04), `readiness.test.ts`                                           |
| 05 wartime maintenance multiplier              | done  | `shipMonthlyMaintenanceCost`/`nationIsAtWar` in `packages/campaign/src/maintenance.ts`; `economyPhases.ts`; `maintenance.test.ts`, `readiness-evolution.test.ts`                            |
| 06 readiness gates battle eligibility          | done  | `packages/combat/src/generation/eligibility.ts`, `resolveCampaignBattleReadiness` in `packages/phase-engine/src/battles.ts`; `eligibility.test.ts`, `battle-generation-phase.test.ts`       |
| 07 readiness/crew in projection + fleet screen | done  | `packages/campaign-engine/src/projection.ts`, `fleet.ts`, `DivisionPicker.tsx`; `projection.test.ts`, `fleet.test.ts`                                                                       |
| 08 author production values (provenance)       | done  | `docs/research/s-1-readiness-and-maintenance.md` provenance table; ADR-0223                                                                                                                 |
| 09 acceptance run                              | done  | `packages/cross-process-test/test/production-pack-loop.test.ts` (S-1 acceptance describe); this report                                                                                      |

## Requirements evidence

- **Working-up ships do not fight (manual p.51).** `gatherEligibleAssets` keys
  `SHIP_WORKING_UP_BATTLE_INELIGIBLE` off the real `WORKING_UP` state; the campaign
  battle phase supplies each ship's real readiness. Proved by
  `battle-generation-phase.test.ts` ("a side with only working-up ships … fights no
  battle") and `eligibility.test.ts`.
- **Reserve/mothballed out of ordinary battles; surprise attack catches them
  (p.69).** `SHIP_LAID_UP_BATTLE_INELIGIBLE`, gated by the named
  `engagementKind` seam; proved by `eligibility.test.ts`.
- **Repair ≈ 2× active; mothballing halts repair (p.51).** `REPAIR` multiplier
  `20_000`; the countdown advances only while `REPAIR`. Proved by
  `maintenance.test.ts`, `readiness-evolution.test.ts`.
- **Mothballed = half maintenance (p.30).** `MAINTENANCE_MOTHBALLED_MULTIPLIER_BP =
  5_000`; proved by `maintenance.test.ts`.
- **Wartime maintenance rises (p.52).** One ruleset multiplier on active status,
  read from war state; proved by `maintenance.test.ts` and
  `readiness-evolution.test.ts`.
- **Crew quality ramps with no randomness; working-up ends at "decent" (p.51).**
  Pure `rampCrewQuality`/`readinessAfterCrewRamp`; the phase is not `rngAllowed`.
  Proved by `readiness.test.ts`, `readiness-evolution.test.ts`.
- **All S-1 values are centralized ruleset constants (ADR-0223).** No S-1 numeric
  gameplay constant is embedded in `economyPhases.ts`, `battlePhases.ts`,
  `opening-briefing`, `projection`, or `torpedoProjection.ts`; the former
  hard-coded battle readiness `80` is removed.

## Commands and observed results

```text
pnpm --filter @bluewave/cross-process-test exec vp test run test/production-pack-loop.test.ts   exit 0 (4 tests, incl. the S-1 acceptance describe)
pnpm check:golden                                                                              All 11 hashes match golden reference
node scripts/assert-authoritative-determinism.mjs                                               ok (16 roots, no ambient determinism)
```

The full standing gate (`pnpm preflight`, `pnpm test:scripts`, `pnpm check`) is run on
the exact ticket-09 commit before delivery; results recorded in the PR body. Commands
not executed are marked unavailable, not passed.

## Determinism evidence

- Content artifact hash: `a6f919a2335292538bcbccc0c1baeb77886f37daaf62fb77f62e209db52df0bc`
- Initial snapshot hash: `39f30c0e1b7089d0284f0fe4199e5a82a12ba9a1d917ddaf44eae58966c9c7ec`
- Closing snapshot hash: `eeff24fb00cc6bede0078aef6a70b1d97580682a49a79036e67e9e2e03c20eee`
- Command ledger hash: `08b3225bcc14ab01371c0fbb72a7f328a467423585ebfa1dc3d072aac17200fa`
- Event ledger hash: `26af2cf3b853a824b98cb33af1d85086748b2848253538f8986e38f014c20ee5`
- Financial ledger hash: `b5b481d9de8ab2d165920cfe61c1d4baa8440b5ca81b90fc41b121fa99fbbf7a`
- Random-decision ledger hash: `cb9e67f9a76ac4c5cc79f85eade020775beaef9053d1f4c0d6ff19eb3100f678`
- Replay result: `bi.6.5` replay verified by the reference run (match)
- Processes and operating systems used: two `node` processes on darwin (arm64)

The reference run is unchanged across S-1 tickets 03–09 because its fleet is all
active, at its crew ceiling, and at peace, so every S-1 value is a no-op on the
reference output. The S-1 acceptance test additionally asserts two in-process runs of
a production-pack month are byte-identical; `pnpm check:determinism` proves the
cross-process identity.

## Canonical artifact changes

- Tickets 03–09: **none** — `golden/hashes.json` is unchanged. Ticket 01 (in `dev`)
  recorded the S-1 readiness/crew snapshot movement with its compatibility bump
  (2.0.0 → 3.0.0) and same-commit re-pin.

## Tests added

- `packages/phase-engine/test/readiness-evolution.test.ts` (ramp, repair countdown,
  wartime, no-op fleet).
- `packages/campaign/test/readiness.test.ts` (ramp helpers, repair-months validation).
- `packages/campaign/test/maintenance.test.ts` (wartime multiplier, war membership).
- `packages/combat/test/generation/eligibility.test.ts` (real readiness gating,
  laid-up exclusion, surprise seam).
- `packages/phase-engine/test/battle-generation-phase.test.ts` (working-up/laid-up
  exclusion in a real month).
- `packages/campaign-engine/test/projection.test.ts` (readiness/crew in the projection;
  maintenance agreement).
- `packages/cross-process-test/test/production-pack-loop.test.ts` S-1 acceptance
  describe.

## Security and cancellation

No new trust boundary or I/O. `repairMonthsRemaining` is validated at the compile
boundary (integer, `0..REPAIR_MONTHS_MAX`) and rejected on excess keys. The S-1 step
consumes no randomness and reads no ambient input.

## ADRs and dependencies

- ADR-0223 (S-1 readiness/crew/maintenance are centralized ruleset constants).
- ADR-0213 (opening-posture magnitudes as `balance_adjustment`).
- No new dependency.

## Known limitations and deferred

- Repair capacity/time interaction (dock or shipyard) is undecided (manual silent);
  deferred to N-1/F-3.
- Per-ship crew quality is not yet threaded into the torpedo auto-resolution model;
  the neutral constant remains (named, `AUTO_TORPEDO_CREW_QUALITY_BP`), a follow-on.
- Special training and fleet exercise (pp.52–53), over-base effects (p.45), and
  mission assignments (S-5/W-1) remain their own efforts.

## Git and remote status

- Branch: `feat/s1-readiness` (PR #23 grows with tickets 03–09).
- Commits: ticket 03 `3bec415`, 04 `c517b61`, 05 `8c08c86`, 06 `f030929`, 07 `cbdbf58`,
  08 `e89af42`, docs/acceptance (ticket 09).
- Merge performed: no.
