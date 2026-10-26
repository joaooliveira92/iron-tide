# ADR-0302: All four training subjects reach battle through one per-side effects record

## Status

Accepted (2026-10-25). Extends [ADR-0301](ADR-0301-gunnery-proficiency-feeds-battle-accuracy.md) from gunnery to every special-training
subject of [ADR-0290](ADR-0290-special-training-program.md). Closes the "effect carried but never read" gap for night fighting, torpedo
tactics and damage control.

## Decision

`BattleTrainingEffects` (`@bluewave/combat/battleResolution`) is one record per side: `gunneryBp`, `nightFightingBp`, `torpedoTacticsBp`,
`damageControlBp`. `trainingEffectsFor` (`@bluewave/phase-engine`) fills it from the nation's proficient programs and the ruleset's
`effectBp`; the monthly auto-resolution and the player-battle session both pass it on `AutoResolverNation.trainingEffects`, and
projection hands it to resolution as `trainingEffects` by side.

| Subject | Where it acts | How |
| --- | --- | --- |
| gunnery | projection | the battery's `training` accuracy factor is `10_000 + bonus` |
| night fighting | each minute | while the battle's time of day is `NIGHT` or `TWILIGHT_NIGHT` (the weather engine's per-minute state, derived from the battle date, observation time and area), the side's batteries scale `training` by the bonus. The stored batteries are not changed, so the bonus never persists past the night |
| torpedo tactics | torpedo planning | the automatic launch solution quality is the 8,000 bp base scaled by the bonus, clamped to 10,000 by the existing solution resolver |
| damage control | each minute | the ship's default pumping and firefighting capacities are scaled by the bonus |

A side with no proficient program, or a run with the `fleetManagement` section absent, gets the neutral record and every value is
unchanged. No random draw is added.

## Visibility is not a new input

Night already exists in the weather engine, so no new "daylight" battle input was added. The static `daylight: true` flag of the
tactical state stays a display value. A battle fights at night when its area and date put the 06:00 UTC observation in darkness.

## Not delivered

Torpedo tactics scale the automatic planner's quality only; a player-ordered launch carries no solution-quality input to scale.
Damage control scales the two capacities the engine already allocates; repair materials, teams and specialists are unchanged.
Japan's discount and the exercise tension consequence remain without a source figure and are handled in ADR-0303.

## Compatibility

Dormant and neutral by default: all 11 golden hashes and 13 replays verify unchanged. `PlayerBattleSession` gains a field that the
session hash does not read; the batteries it does hash are unchanged without proficient training.
