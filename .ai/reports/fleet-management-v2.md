# Validation report: Fleet management v2 (1880–1920)

Status: **accepted with listed gaps** as of `feat/fm-go-live` (off `dev` @ `bf163a1a`).
Spec [#265](https://github.com/joaooliveira92/iron-tide/issues/265); go-live ticket
[#277](https://github.com/joaooliveira92/iron-tide/issues/277). The layer is live in the
production pack: the 1880 core ruleset authors the `fleetManagement` section from the
balance targets of ADR-0283, adopted under the owner's standing delegation on map #193.

## What landed

| Ticket                                           | State | Evidence                                                                                                                                                                             |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 267 value grounding                              | done  | ADR-0283, `docs/research/fleet-management-values.md`                                                                                                                                 |
| 268 gate evaluator, dormant section              | done  | ADR-0286; `packages/campaign/test/eligibility.test.ts`, `packages/content-compiler/test/fleetManagementRules.test.ts`                                                                |
| 269 readiness command                            | done  | `packages/campaign/test/readinessCommand.test.ts`, `packages/phase-engine/test/ship-readiness-command.test.ts`                                                                       |
| 270 assignment slot                              | done  | `packages/campaign/test/stationAssignment.test.ts`, `packages/phase-engine/test/station-assignment.test.ts`                                                                          |
| 271 battle absence record                        | done  | ADR-0287; `packages/phase-engine/test/battle-absences.test.ts`, `packages/campaign/test/battleAbsence.parity.test.ts`, `packages/persistence/test/declined-battle-roundtrip.test.ts` |
| 272 role and formation penalties, speed advisory | done  | ADR-0289; `packages/campaign/test/divisionDoctrine.test.ts`, `packages/phase-engine/test/division-doctrine-command.test.ts`, `FleetOrganizationView.test.tsx`                        |
| 273 monthly cohesion growth                      | done  | ADR-0288; `packages/campaign/test/divisionCohesionGrowth.test.ts`, `packages/phase-engine/test/division-cohesion-growth.test.ts`                                                     |
| 274 special training                             | done  | ADR-0290; `packages/campaign/test/specialTraining.test.ts`, `packages/phase-engine/test/special-training.test.ts`, `apps/desktop/src/main/commands/specialTrainingCommands.test.ts`  |
| 275 annual fleet exercise                        | done  | ADR-0291; `packages/campaign/test/fleetExercise.test.ts`, `packages/phase-engine/test/fleet-exercise.test.ts`, `apps/desktop/src/main/commands/fleetExerciseCommands.test.ts`        |
| 276 battle experience write-back                 | done  | ADR-0292; `packages/campaign/test/divisionExperience.test.ts`, `packages/phase-engine/test/battle-experience.test.ts`                                                                |
| 277 go-live and this report                      | done  | ADR-0293; replay corpus and approvals below                                                                                                                                          |

## Spec user stories

| Stories                                                                                                                            | Evidence                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–10 readiness command, refusals, repair pause, no fee, targetable in reserve                                                      | `readinessCommand.test.ts`, `ship-readiness-command.test.ts`, fleet screen buttons (`useStationAssignment.test.tsx`). Story 10 has no restriction in code and no dedicated test. |
| 11–13 one explanation per ship from ordered failed gates, crew quality the only graded number                                      | `eligibility.test.ts`, `battle-absences.test.ts` (low crew quality is never a reason)                                                                                            |
| 16–19 one assignment slot, allowed uses per kind, divisions stay pure                                                              | `eligibility.test.ts`, `stationAssignment.test.ts`, `fleet-exercise.test.ts` (EXERCISE bars every use)                                                                           |
| 20–22 monthly cohesion growth and its stop conditions                                                                              | `divisionCohesionGrowth.test.ts`, `division-cohesion-growth.test.ts`, replay `production-1880-14m-fleet-management`                                                              |
| 23 experience from battle and exercise                                                                                             | `battle-experience.test.ts`, `fleet-exercise.test.ts`                                                                                                                            |
| 24 cohesion and experience affect only battle values                                                                               | unchanged existing behaviour; nothing in campaign movement reads them                                                                                                            |
| 25–28 role and formation penalties, speed advisory with no effect                                                                  | `divisionDoctrine.test.ts`, `division-doctrine-command.test.ts`, `division-screen.test.ts`, `FleetOrganizationView.test.tsx`; replay month 2                                     |
| 29–34, 57 training subjects, twelve months, reset, adders, ACTIVE ships, limit of two                                              | `specialTraining.test.ts`, `special-training.test.ts`, `specialTrainingCommands.test.ts`, `FleetTrainingView.test.tsx`; replay months 1–14                                       |
| 35–40, 58 exercise once a year, double maintenance, experience, refusals, unavailable, projection                                  | `fleetExercise.test.ts`, `fleet-exercise.test.ts` (projection equals executed charge), `fleetExerciseCommands.test.ts`, `FleetExerciseView.test.tsx`; replay months 3–4          |
| 41–43, 45 absence record at battle time, candidates only, no crew reason                                                           | `battle-absences.test.ts`                                                                                                                                                        |
| 46–48 gated values dormant until authorised, in ruleset data                                                                       | dormancy tests in each phase-engine suite; `rulesets.yaml` carries every value with provenance                                                                                   |
| 50–56 one evaluator, closed reason enum, integer maths, command table, strict decoding, additive state, one maintenance calculator | `eligibility.test.ts`, `maintenance` callers (`economyOutlook`, `economyPhases`, `treasuryCommitments`) share `nationMaintenanceAdders`; schema parity tests listed above        |
| 59 save and load preserve training, exercise and absences                                                                          | replay verification re-loads every month through `SaveStore`; `declined-battle-roundtrip.test.ts` for absences                                                                   |
| 60 assignment slot and gates as extension points                                                                                   | ADR-0286 section 3, ADR-0291                                                                                                                                                     |

### Gaps, stated plainly

- **Stories 14 and 15** (derived conditions shown on ships: understrength, detached, damaged, out of action) are not covered by any ticket in this set and are not delivered.
- **Story 44** (reasons in the player's language): reasons render through an English label map in the renderer, not the localised structured explanation data the spec names.
- **Story 49** (every shown number traces to an explanation tree): training, exercise and doctrine costs are stated in text, not as explanation trees.
- **Story 34 and the training effect**: proficiency is tracked and costs maintenance, but its battle effect (`effectBp`) is carried in the ruleset and not read by combat (ADR-0283 follows up).
- **Absences and battle experience have no replay scenario**: the production start has no war, so the corpus produces no battle. Both are covered at phase-engine level with a fixture war. Replay coverage needs a war scenario.
- **Japan's discount** and **the exercise tension consequence** are not modelled (ADR-0283).
- **`pnpm snap`**: verified the doctrine selectors and speed note, the training section through queue, month advance and "1 of 12 months", and the exercise section. A battle report with absent ships was not seen in the running app.

## Replay corpus and approvals

- `golden/hashes.json`: no hash moves (the proof compiles a synthetic fixture, not the production pack).
- Content lock `bodyHash` `f5a32dcb…` → `c4922fbf…`.
- The replay executor now passes the production `fleetManagement` rules (`corpus.ts` `advance`), so the eleven existing replays run the live section: monthly cohesion growth moves every checkpoint from the second month. All moved checkpoints carry append-only approval entries, class `EXPECTED_GAMEPLAY_CHANGE`.
- New replay `production-1880-14m-fleet-management` (Austria-Hungary, the corpus's authorised slot): training from month 1 reaching proficiency at month 12, a doctrine change at month 2 (cohesion 30 → 15), the exercise ordered at month 3 and held at month 4 (maintenance 7 → 10, experience 20 → 25), one subject dropped at month 13. A new replay file needs no approval.
- `golden/replay-fuzz.json` re-recorded locally for the live section.
- The desktop continuity replay (`continuityCommands.ts`) now passes the fleet-management rules and the player nation, so saved turns re-verify.

## Commands run and observed results

| Command                                                                                                                  | Observed result                                           |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm preflight`                                                                                                         | exit 0                                                    |
| `pnpm format`                                                                                                            | exit 0                                                    |
| `pnpm lint`, `pnpm lint:effect`                                                                                          | exit 0                                                    |
| `pnpm test:scripts`                                                                                                      | 376 tests, 376 pass                                       |
| `pnpm check:licenses`                                                                                                    | exit 0                                                    |
| `pnpm typecheck`                                                                                                         | exit 0                                                    |
| `pnpm build`                                                                                                             | exit 0                                                    |
| `pnpm content:verify`                                                                                                    | exit 0 (hash `c4922fbf…`)                                 |
| `pnpm test:run`                                                                                                          | exit 0                                                    |
| `pnpm test:heavy`                                                                                                        | exit 0                                                    |
| `pnpm check:golden`                                                                                                      | all 11 hashes match                                       |
| `pnpm check:determinism`, `pnpm check:equivalence`                                                                       | byte-identical across two fresh processes                 |
| `pnpm check:replay-corpus`                                                                                               | 12 replays verified, identical across two fresh processes |
| `pnpm check:replay-approvals`                                                                                            | corpus delta fully approved                               |
| `pnpm check:golden-repin`, `pnpm check:probe-retirement`, `pnpm check:balance-reports`, `pnpm check:reachability-ledger` | exit 0                                                    |
| `pnpm test:e2e`                                                                                                          | 28 passed                                                 |

`pnpm check` was not invoked as one command; each of its steps was run as listed.

## Compatibility

All new state is optional and absent from existing saves (`specialTraining`, `fleetExercise`, a battle's `absences`, the `EXERCISE` assignment). `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning). An old save loads with the section live; its divisions simply begin to gain cohesion.
