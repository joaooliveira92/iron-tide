# ADR-0357: Training, Exercises, Division Growth and Explanation Trees

Consolidates: ADR-0288, ADR-0289, ADR-0292, ADR-0297, ADR-0301, ADR-0302, ADR-0303, ADR-0304, ADR-0316, ADR-0317

Applies to: campaign, phase-engine, combat, commands, desktop, events, content, content-compiler, content-schema

Rule: Division cohesion and experience grow through pure rules; special training is a nation program with proficiency tracked in funded months; exercises are commanded for the following month through the assignment slot and cost doubled active maintenance; training effects reach battle through one per-side effects record; displayed numbers carry explanation trees built from the same calculation the engine uses.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0288
Supersedes: ADR-0289
Supersedes: ADR-0292
Supersedes: ADR-0297
Supersedes: ADR-0301
Supersedes: ADR-0302
Supersedes: ADR-0303
Supersedes: ADR-0304
Supersedes: ADR-0316
Supersedes: ADR-0317

## Context

The fleet-management v2 effort (spec #265) required mechanisms for division growth, training, exercises and combat feedback, plus explanation trees for player-facing numbers.

ADR-0288 added monthly cohesion growth through `growDivisionCohesion` in `@bluewave/campaign`. The rule raises cohesion by the ruleset's monthly growth when the division was not reorganised and every ship is `ACTIVE`, operational and present. The step runs at the end of `applyReadinessEvolution` with no random draws. Battle does not stop growth.

ADR-0289 added the `ChangeDivisionDoctrine` command (role, formation, or both) with typed refusal codes. `applyDivisionDoctrineChange` stamps `lastReorganizationMonth` so cohesion growth pauses that month, and subtracts the ruleset's reorganisation penalty for each field that changed. The derived `divisionSpeedAdvisory` computes the slowest ship and fastest speed when members differ, stored nowhere.

ADR-0292 added battle experience write-back through `DivisionExperienceRequest`. After the battle-resolution phase scores prestige, each newly resolved battle in id order credits every division of every nation that fought. Each request appends a `DivisionExperienceChanged` event.

ADR-0297 aligned engine technology ids to catalogue entries where a match exists. Three ids moved (`early_jet_carrier_operations` → `av_carrier_jet`, magnetic/acoustic ids → `m_asw_influence_mine`, `long_range_submarine_technology` → `sub_ww1_ocean_boat`); five ids stayed unmatched because the catalogue has no counterpart.

ADR-0301 connected gunnery proficiency to battle accuracy: `gunneryTrainingBpFor` returns the ruleset's `training.subjects.GUNNERY.effectBp` once the nation's entry reaches `proficiencyMonths`. `AutoResolverNation.gunneryTrainingBp` carries it into combat; projection sets each main battery's `training` accuracy factor to `10_000 + gunneryTrainingBp`.

ADR-0302 extended this to all four training subjects through one `BattleTrainingEffects` record per side. Gunnery acts on projection, night fighting scales per-minute `training` at `NIGHT`/`TWILIGHT_NIGHT`, torpedo tactics scale automatic solution quality from the 8,000 bp base, and damage control scales pumping and firefighting capacities.

ADR-0303 added per-nation training cost multipliers (`training.nationCostMultiplierBp`, optional map from nation id to 5,000–10,000 bp) and the exercise tension extension point (`exercise.tension` block with `minShips`/`increase`/`ceiling`). The 1880 pack lists `japan: 8000` (a fifth off added maintenance only). The tension block is absent from the 1880 pack and dormant.

ADR-0304 introduced the `ExplanationTree` contract for player-facing numbers: `formulaId`, `formulaVersion`, `inputs`, `intermediate`, `result`, `unit`, `operation`, `source`, `children`. The domain emits the tree with canonical integers and stable ids; presentation turns it into text. Node `operation` is one of `identity`, `add`, `subtract`, `multiply`, `divide`, `round`, `clamp`. Node `source` is `{ kind, ref }` with kind one of `ruleset`, `content`, `manual`, `code`. The first slice was gunnery accuracy; subsequent area slices covered economy and budget, research, construction and yards (schedule, instalment, cost), fleet (presence shortfall, training adder/progress, exercise gain), reports (treasury), prestige change, and priorities advice. A coverage gate (`scripts/verify-explanation-coverage.mjs`) enforces a minimum covered percentage that only ratchets up.

ADR-0316 implemented special training as a nation program: `NationState.specialTraining` is an optional list of `{ subject, fundedMonths, maintenanceAdderBp }` at most `maxSubjects`. `SetSpecialTraining` replaces the set. At the end of readiness evolution each funded subject gains one funded month, stopping at `proficiencyMonths`. Proficiency is derived, not stored. The summed maintenance adder is applied to `ACTIVE` ships' monthly cost.

ADR-0317 implemented the annual fleet exercise: `HoldFleetExercise` names ships, validated through the gate evaluator with `TAKE_MISSION`. The exercise is held in the month after the command. The `EXERCISE` assignment slot allows no uses. Active ships on exercise pay `(maintenanceMultiple - 1) * 10000` bp more. At the end of readiness evolution, ships are released and each division with an exercising ship gains the ruleset's per-exercise experience, clamped to 100.

## Rules

1. **Division cohesion growth.** `growDivisionCohesion` returns the division unchanged unless it was not reorganised in the current month and every ship in its order is `ACTIVE`, operational (not under construction, not `UNAVAILABLE`) and present. Otherwise cohesion rises by `divisionCohesion.monthlyGrowth`, never above `divisionCohesion.cap`, and never lowered when already above the cap. The aggregate hash is recomputed. There are no random draws. The step runs at the end of `applyReadinessEvolution` so a ship finishing working up this month already counts as `ACTIVE`. Battle does not stop growth. The step runs only when the `fleetManagement` engine option is present.

2. **Division doctrine command.** `ChangeDivisionDoctrine` names a division and a role, a formation, or both. It is refused with a typed code when the division is unknown, neither field is named, a value is not in the closed role or formation list, or nothing would change. Combat's role and formation legality stays where it is and is enforced at battle time. `applyDivisionDoctrineChange` stamps `lastReorganizationMonth`, so cohesion growth pauses that month, and subtracts the `reorganisationPenalty` cohesion and experience of each field that changed, clamped to 0..100. With the `fleetManagement` option absent the change is free; the penalty is read from the ruleset and never from code.

3. **Speed advisory.** `divisionSpeedAdvisory` derives, from the members' ship speeds, the slowest ship and the fastest speed when they differ. It is not stored and has no campaign effect; the division screen shows it as a note. No threshold is introduced, so no unsourced number is invented.

4. **Battle experience.** `DivisionExperienceRequest` carries `nationId`, `divisionId`, a closed reason code (`BATTLE_PARTICIPATION`), the source battle id and a non-negative integer number of points. `battleExperienceRequests` produces one request per division holding a participating ship, in nation then division code-point order. `applyDivisionExperienceRequest` applies it, clamps to 0..100 and refreshes the aggregate hash. After the battle-resolution phase scores prestige, `applyBattleExperience` reads each newly resolved battle in id order. Participants are the manifest's persistent assets or the ships of the battle's fleets when no manifest exists. Every division of every nation that fought is credited. Each applied request appends a `DivisionExperienceChanged` event. A request that changes nothing, such as a division already at 100, emits nothing. The points are `divisionExperience.perBattle` of the `fleetManagement` option.

5. **Special training program.** `NationState.specialTraining` is an optional list of `{ subject, fundedMonths, maintenanceAdderBp }` in canonical subject order, at most the ruleset's `maxSubjects` long. The adder is copied from the ruleset when a subject is first funded and carried in the snapshot. `SetSpecialTraining` replaces the funded subject set. A kept subject keeps its months; a dropped subject is gone immediately, and funding it again starts at zero. Validation refuses unknown or repeated subjects. The limit and the dormant case are refused with typed codes (`TRAINING_SUBJECT_LIMIT_EXCEEDED`, `TRAINING_DORMANT`) at submit time in the desktop main process, and again by the phase handler as a diagnostic. At the end of readiness evolution each funded subject gains one funded month, stopping at `proficiencyMonths`. Proficiency is `fundedMonths >= proficiencyMonths`; it is derived, not stored. `nationMonthlyMaintenance` and `fleetMaintenanceBreakdown` take the summed adder and add it to the monthly cost of `ACTIVE` ships only.

6. **Training cost multipliers.** `training.nationCostMultiplierBp` is an optional map from nation id to a multiplier between 5,000 and 10,000 basis points. `trainingAdderBp` applies it, flooring, to the ruleset's maintenance adder when a subject is first funded, so a nation's stored entry keeps the price it was funded at. Nations not listed pay the ruleset adder. The 1880 pack lists `japan: 8000`, a fifth off the added maintenance only (gunnery 3000 bp becomes 2400 bp), a conservative target at LOW confidence: the discount can never exceed half the adder and never touches base maintenance. The desktop projection shows the nation's own adder. The multiplier changes the 1880 content hash; replays were re-recorded with only `contentHash` moved and every checkpoint hash identical.

7. **Annual fleet exercise.** `HoldFleetExercise` names ships. Validation reuses the gate evaluator with the `TAKE_MISSION` use; an ineligible ship is refused with its gate code (`FLEET_EXERCISE_REJECTED`, detail `ship=Code`). The calendar-year limit and the dormant case are refused with `FLEET_EXERCISE_LIMIT_REACHED` and `FLEET_EXERCISE_DORMANT`. The exercise is held in the month after the command. The command marks the ships `EXERCISE` in the assignment slot at once and records `NationState.fleetExercise` (`month`, `year`, `yearCount`, `shipIds`, `maintenanceAdderBp`). `EXERCISE` allows no use (`ASSIGNMENT_ALLOWED_USES.EXERCISE` is empty): the ships cannot sail, fight, hold a station or take a mission, and battle absences record `AssignmentForbidsUse`. In the exercise month an `ACTIVE` ship holding `EXERCISE` pays `(maintenanceMultiple - 1) * 10000` basis points more (twice active maintenance for the default multiple). At the end of readiness evolution in the exercise month, ships are released and each division with an exercising ship gains `divisionExperience.perExercise`, clamped to 100, once however many of its ships took part. The record stays for the yearly limit.

8. **Exercise tension.** `exercise.tension` is an optional block `{ minShips, increase, ceiling }` (increase 1 to 5, ceiling 1 to 9). In the month an exercise is held with at least `minShips` participants, the diplomacy phase raises tension by `increase`, up to `ceiling`, with every nation the exerciser is neutral toward. Allies, trade partners and enemies are untouched; the ceiling stays below the war level of 10. The block is not authored in the 1880 pack and is dormant. Authoring it is a one-line ruleset change plus a replay re-approval once a source or owner target exists.

9. **Training effects in combat.** `BattleTrainingEffects` is one record per side: `gunneryBp`, `nightFightingBp`, `torpedoTacticsBp`, `damageControlBp`. `trainingEffectsFor` fills it from the nation's proficient programs and the ruleset's `effectBp`; the monthly auto-resolution and the player-battle session both pass it on `AutoResolverNation.trainingEffects`.
   - **Gunnery:** the battery's `training` accuracy factor is `10_000 + bonus`.
   - **Night fighting:** each minute while the battle's time of day is `NIGHT` or `TWILIGHT_NIGHT` (the weather engine's per-minute state), the side's batteries scale `training` by the bonus. The stored batteries are not changed.
   - **Torpedo tactics:** the automatic launch solution quality is the 8,000 bp base scaled by the bonus, clamped to 10,000 by the existing solution resolver.
   - **Damage control:** the ship's default pumping and firefighting capacities are scaled by the bonus.
   A side with no proficient program, or a run with the `fleetManagement` section absent, gets the neutral record and every value is unchanged. No random draw is added.

10. **Engine technology ids.** Where an engine code gate references a technology id that the catalogue carries under a different name, the engine constant moves, never the catalogue id. Three ids moved: `early_jet_carrier_operations` → `av_carrier_jet` (the only carrier-borne jet technology); `magnetic_mine_technology`, `acoustic_mine_technology` → `m_asw_influence_mine` (its authored name is "Magnetic and Acoustic Influence Mines"); `long_range_submarine_technology` → `sub_ww1_ocean_boat` (the ocean-going submarine). Five ids stay as they are because the catalogue has no counterpart: `modern_jet_carrier_operations`, `controlled_mine_technology`, `minelaying_submarine_technology`, `missile_submarine_technology`, and the aviation ids in `hasAviationTech`. A cross-process test (`engine-technology-ids.test.ts`) fails if a migrated id leaves the production catalogue.

11. **Explanation tree contract.** An explanation is the `ExplanationTree` of `@bluewave/events`: `formulaId`, `formulaVersion`, `inputs`, `intermediate`, `result`, `unit`, `operation`, `source`, `children`. It is built by `ExplanationBuilder`, which freezes it and rejects non-finite numbers. The domain emits the tree with canonical integers and stable ids; the presentation boundary turns it into text and numbers (ADR-0221). `operation` is one of `identity`, `add`, `subtract`, `multiply`, `divide`, `round`, `clamp`. `source` is `{ kind, ref }` with `kind` one of `ruleset`, `content`, `manual`, `code`. The builder rejects an unknown operation and an empty source reference.

12. **Node identity and labels.** A node's `formulaId` is stable and dotted (`gunnery_accuracy`, `gunnery_accuracy.training`). A labelled node id is `<formula>.<node>`. The renderer derives its message key as `<area>.<formula>.<node>` through one helper. A catalogue test fails when an id the engine can emit has no label. Children appear in canonical factor order, never insertion or locale order.

13. **Hidden information.** An explanation is attached only to the viewer's own side. The player-battle view carries gunnery accuracy for the player's gunned ships and omits it for the enemy's. Battle numbers beyond accuracy (torpedo solution, damage control, battle loss) follow the same contract.

14. **Coverage gate.** `scripts/data/explanation-coverage.json` lists each displayed view contract under coverage with its numeric and `ExplanationTree` fields, the covered formula per field, and a reason per exemption. The gate (`scripts/verify-explanation-coverage.mjs`, `pnpm check:explanation-coverage`) fails when a listed field has neither an explanation nor an exemption, when an entry is stale, or when the covered percentage falls below `minimumCoveredPercentBp`. The ratchet only moves up.

15. **Area slices covered.** Economy and budget (#300): `PlayerProjectionEconomy` carries net, month-end, runway and appropriation explanations. Research (#303): `ResearchScreenProjection` carries budget, cap and floor explanations. Construction and yards (#302): `ConstructionProjectReadoutView` carries schedule, instalment and cost explanations. Fleet (#301): presence shortfall, training adder/progress, exercise gain. Reports (#306): `MonthlyReportTreasury` carries treasury explanation. Prestige (#304): `PlayerProjectionPrestige.changeExplanation` carries the prestige change tree. Priorities (#285): every priority carries a player-readable `advice` sentence beside its engine `reason`.

## Compatibility

All mechanisms are additive and dormant without the `fleetManagement` section. State fields (training progress, exercise history, division cohesion and experience) stay optional; `CURRENT_COMPATIBILITY_VERSION` is unchanged (ADR-0264 reasoning). Replays move only when production behaviour changes (cohesion growth, training adder, exercise costs) and are re-recorded with `EXPECTED_GAMEPLAY_CHANGE` approval entries. Explanation trees are unhashed and add no snapshot, replay or save fields. The 1880 pack content hash moves when the training cost multiplier is authored; replays were re-recorded and the lock refreshed.