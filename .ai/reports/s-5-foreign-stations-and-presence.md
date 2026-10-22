# Acceptance report: S-5 foreign stations and presence

Status: **behaviour implemented and accepted under fixture values only** (ticket 11, #87; spec #73
R15) on `feat/milestone-54`. The production `presence` ruleset section is **dormant (absent)**, so
production behaviour and goldens are unchanged. Production values (#85) and the S-5 follow-up
(#165, possession transfer) remain blocked on owner decisions. Nothing here claims production
presence rules are live.

## What landed

| Ticket                                                    | State       | Evidence                                                           |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| 01 value grounding                                        | done        | `docs/research/s-5-presence-and-base-limits.md` (provenance table) |
| 02-04 assignment state, colonial fitting, ruleset section | done        | ADR-0241, ADR-0242                                                 |
| 05 measurement, requirement, shortfall (#79)              | done        | ADR-0247                                                           |
| 06 blockade exemption and typed penalty requests (#80)    | done        | ADR-0248                                                           |
| 07 foreign-station routing (#81)                          | done        | ADR-0249                                                           |
| 08 base limits (#82)                                      | done        | ADR-0250                                                           |
| 09 fleet screen and presence readout (#83)                | done        | ADR-0251                                                           |
| 10 authoring production values (#85)                      | **blocked** | decision requests 0017-0023, 0026                                  |
| 11 acceptance (this report, #87)                          | done        | `packages/cross-process-test/test/s5-acceptance.test.ts`           |

## Acceptance evidence

The acceptance scenario `runS5Acceptance` (`packages/cross-process-test/src/s5-acceptance.ts`)
compiles the 1880 production pack, runs strategic months through `MonthExecutor` under a
**fixture-class** `presence` section (labelled in the source; never reaches the production
pack) and observes authoritative state and events. The test asserts each item:

- **FS assignment and clear:** `AssignForeignStation` sets `FOREIGN_STATION` (event reason
  `ASSIGNED`); `ClearForeignStation` removes it (`CLEARED_BY_COMMAND`); clearing an unassigned
  ship is rejected.
- **1.5x weighting:** a colonial-service ship on FS adds exactly `floor(tons / 2)` more present
  tons than the same ship unweighted, and the shortfall event agrees with the measured row.
- **Reserve/mothballed exclusion:** the same ship in RESERVE or MOTHBALLED contributes 0.
- **Blockade exemption and its end:** a nation at war and blockaded emits no shortfall or
  request; the same blockade with the war ENDED restores every event; base-limit flags are
  identical with and without the blockade (not exempt).
- **Routing:** an FS ship outside the shortfall areas sails one adjacent sea hop toward the
  nation's largest shortfall area (ties by area id).
- **Shortfall and penalty-request events:** one `PresenceShortfall`, one `PrestigeLossRequested`
  and one `RevoltPressureRequested` per shortfall; requests change no state (snapshot hash equals
  the dormant run). The dormant section emits none.
- **Over-base flag:** with the fixture base-limit block, ships beyond the limit carry `overBase`
  with reduced crew quality; without the block none do.
- **Cross-process determinism:** the observation from two clean `node` processes is byte-identical
  to each other and to the in-process run.

## Determinism evidence

Same month, seed `s5-acceptance-seed`, darwin arm64, two child processes plus in-process:

- Old (production section dormant) snapshot hash:
  `53552f150c21970f3e43318684a1bfe27c3e5c9170d5766fb5e7dabf5aac9182`
- Old event ledger hash: `2f28c50deae78b4a280c1b1dcae65af76b2972ee8f84dd58ce0db311e53ee191`
- New (fixture section with base-limit block) snapshot hash:
  `b36f33290b764f7f8c6d2369d0f00aa5a20f0695b10e71fbc5dcf5b43cb8cf38`
- New event ledger hash: `2c6236cfd86093c2bac04c0b059add3b7647693562f49a7c2811914856c2bcd8`

The "new" hashes are fixture-class and are **not** production hashes or goldens. `golden/hashes.json`
is unchanged by this ticket (and by tickets 05-09).

## Ruleset section state

**Dormant** in production. The optional `presence` section is absent from
`content/production/1880`; no requirement, limit, shortfall, penalty or base consequence is live.
The fixture section exists only inside the test seam.

## Provenance table pointer

`docs/research/s-5-presence-and-base-limits.md`, section "Provenance table". Only decision request
0016 (tonnage-required formula) is resolved (Option C, ADR-0213 `balance_adjustment`, 2026-10-20);
it is not authored into production because the section is all-or-nothing and the rest is blocked.

## S-2 / S-3 dependency status

S-5 emits typed `PrestigeLossRequested` and `RevoltPressureRequested` events only (ADR-0248).
**No consumer exists** on this branch: S-2 prestige loss and S-3 revolt pressure have not
consumed them, and magnitudes and trigger are gated (decision request 0023). Consumption stays a
dependency on S-2/S-3 artifacts. A-1 and F-1 consume S-5 later.

## Production go-live (#85, 2026-10-21)

The owner delegated every open S-5 decision (ADR-0266, requests 0016-0023 and 0026, Option C), which is the
explicit owner waiver ADR-0213 requires. The 1880 core ruleset now carries the `presence` section; every value is
`balance_adjustment` / `BALANCE_TARGET`, none is `manual`. The only sourced figure, the 1.5x colonial multiplier
(manual p.46), stays in code.

| Value                             | Authored                               | Decision |
| --------------------------------- | -------------------------------------- | -------- |
| `requiredTonsPerPossessionWeight` | 150                                    | 0016     |
| `noPortValueWeight`               | 2                                      | 0016     |
| `baseLimits.limitByBaseLevel`     | 2 x level, 2..20                       | 0017     |
| `baseLimits.noBaseLimit`          | 2                                      | 0017     |
| `baseLimits.occupyingStates`      | ACTIVE, RESERVE, WORKING_UP, REPAIR    | 0018     |
| `baseLimits.maintenanceAdderBp`   | 2500                                   | 0019     |
| `baseLimits.crewQualityReduction` | 2                                      | 0019     |
| `crampedOrShortRangeCountBp`      | 5000                                   | 0020     |
| `colonialServiceDisplacementBp`   | 1500                                   | 0021     |
| `penaltyRequests`                 | true (magnitudes recorded for S-2/S-3) | 0023     |

Home area carries a requirement and the blockade exemption covers it (0022, as built).

Golden re-pin report (docs/agents/golden-repinning.md)

- Cause: the `presence` ruleset section authored in the production pack.
- Content lock bodyHash 337cc1eb...0aa2 -> a0392f41...6ad9.
- Replay corpus (ten files): contentHash moved on each; every checkpoint hash is unchanged, so no approval entry
  is needed beyond the corpus delta check, which passes. `pnpm check:replay-corpus` verifies identically across two
  fresh processes with the section active.
- `golden/hashes.json`: unchanged (its proof compiles a synthetic fixture, not the production pack).
- Migration assessment: none. Wire formats and the compatibility version are unchanged; presence state is derived.

## Still open

- 0026 is decided (cramped = SPARTAN, short-range = cruise range under 2500 nm) but the compile step that writes
  `crampedAccommodation` / `shortRange` is a separate ticket, so no production ship is reduced yet.
- 0015 (`FC_INCOMPATIBLE` severity) is a separate ticket. 0027 / #165 is deferred.

## Commands and observed results

```text
pnpm --filter @bluewave/cross-process-test exec vp test run test/s5-acceptance.test.ts   9 passed
pnpm preflight / pnpm test:scripts / pnpm check                                          exit 0 each
```

## Gate results

`pnpm preflight`, `pnpm test:scripts` and `pnpm check` were run green on the delivery commit
(the commit containing this report); the tree was clean afterwards.

## Known limitations

- The acceptance run used fixture values; production presence is live from #85 on ADR-0266 balance targets, awaiting a balance sweep.
- Cramped and short-range ships are not yet classified in production (0026 compile step pending).
- Penalty requests have no consumer yet (S-2/S-3).
