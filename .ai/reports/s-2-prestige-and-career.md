# Acceptance report: S-2 prestige and career

Status: **done on the production pack** (ticket 09, #94; spec #74 R11 to R13). Values are the owner-authorized balance targets of
[ADR-0239](../../docs/adr/ADR-0239-s2-prestige-values-balance-targets.md); sacking and the career end are recorded by
[ADR-0281](../../docs/adr/ADR-0281-sacking-phase-and-terminal-career.md). No new mechanic or value is introduced by this ticket.

## Acceptance evidence

`runS2Acceptance` (`packages/cross-process-test/src/s2-acceptance.ts`) compiles the 1880 production pack and drives `MonthExecutor`
with uk as the player. The test `packages/cross-process-test/test/s2-acceptance.test.ts` asserts the observations and that the
in-process run and two clean `node` processes are byte-identical.

| Scenario     | Observed                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UNPAID_FUNDS | uk with an unpayable obligation: 20 to 19, one `PrestigeChanged` (PROPORTIONAL_LOSS, 300 bp)                                                                      |
| BATTLE_LOST  | uk loses a real resolved battle in `eng_home_coast`: 20 to 19 (PROPORTIONAL_LOSS, 500 bp)                                                                         |
| BATTLE_WON   | uk wins a real resolved battle: 20 to 21 (FIXED_GAIN, +1)                                                                                                         |
| SACKED       | prestige at the threshold of 16, seed `s2-acceptance-sack-22`: one `prestige_sacking` draw, `careerResult` uk, score 16, SACKED; a retained seed keeps the career |
| CAMPAIGN_END | uk in 1970-11: result uk, score 20, CAMPAIGN_END, month 1970-12; a repeated advance returns `career_ended`                                                        |
| Seeding      | all fourteen nations carry an integer inside the bounds; the player starts at 20                                                                                  |

Battle and sack seeds are searched deterministically from fixed prefixes, so the run is reproducible.

## Requirement coverage

| Req                        | Ticket(s) | Evidence                                                                                                                                                                    |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 rule layer              | #86       | `campaign/test` prestige rule tests                                                                                                                                         |
| R2 value grounding         | #84       | ADR-0239, decision request 0012                                                                                                                                             |
| R3 state and seeding       | #88       | `campaign/test/prestige-compile.test.ts`, `persistence/test/prestige-roundtrip.test.ts`; compatibility 3.1.0 to 4.0.0                                                       |
| R4 application             | #89       | `phase-engine/test/prestige-unpaid-funds.test.ts`                                                                                                                           |
| R5 unpaid funds            | #89       | same, and the acceptance row above                                                                                                                                          |
| R6 battle outcomes         | #90       | `phase-engine/test/prestige-battle.test.ts` (loss, win, tie, non-participant, scored once)                                                                                  |
| R7 sacking                 | #91       | `phase-engine/test/sacking-phase.test.ts` (no draw above, one recorded draw at or below, ordering after a same-month loss)                                                  |
| R8 terminal career         | #91, #92  | `sacking-phase.test.ts` (refusal leaves the snapshot untouched); `desktop commitMonth.test.ts` (`CAREER_ENDED`)                                                             |
| R9 career result           | #91, #92  | `sacking-phase.test.ts` (sack precedence at the final month), `persistence/test/prestige-roundtrip.test.ts` (both reasons)                                                  |
| R10 projection and display | #93       | `campaign-engine/test/projection-prestige.test.ts`, `status-strip-state.test.ts`, `SiteHeader.test.tsx`; verified in the running app with `pnpm snap`                       |
| R11 determinism            | #91, #94  | acceptance test (two clean processes), `check:determinism`                                                                                                                  |
| R12 non-regression         | all       | `check:golden` unchanged by tickets 05 to 08 (absent fields while dormant); the existing offer and offer-response dormancy tests now exclude only the player's own prestige |
| R13 evidence               | #94       | this report; `.ai/SPRINT-PLAN.md` S-2 row                                                                                                                                   |

## Golden hashes

Moved once, by #88 (commit 5f783ab3): cause "new required prestige state", migration assessment refusal of older saves
(compatibility 4.0.0). Old content artifact hash `134f0bb2...06e9`, new `6d3d5dce...188e` (full set in `golden/hashes.json` history).
Tickets #90 to #93 move no reference hash: the career result and last-change fields exist only after a source fires, and production
months in the reference run have no player nation.

## Value set and provenance (ADR-0239)

Bounds 0 and 1000; threshold 16 (documented RTW3, manual p.62); UNPAID_FUNDS 300 bp, BATTLE_LOST 500 bp, BATTLE_WON +1, sacking
1000 bp monthly, flat-20 seeding, score = final prestige: Bluewave balance targets under the owner waiver recorded in the ADR. No
value is unsourced and unlabelled; no fixture value is in the production pack (asserted by the production-pack loop).

## Open observations

- Excluded sources: war won or lost and capital-ship loss (not stated by the manual).
- Campaign span: the final month is December 1970 from the existing timeline, while authored technology stops at 1939.
- AI prestige: stored and seeded for every nation, inert; AI nations are never sacked.
- The desktop applies the player-only sources only when the battle-offer section is loaded, because that is what supplies the player nation to the month executor.
- Hall of Fame list and screen are deferred.
