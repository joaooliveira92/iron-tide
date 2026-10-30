# ADR-0301: Proficient gunnery training raises the nation's gunnery accuracy in battle

Applies to: combat, phase-engine

## Status

Superseded by: ADR-0357

Accepted (2026-10-25). Delivers the "proficiency effect in combat" follow-up of [ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md)
and [ADR-0316](ADR-0316-special-training-program.md), for the one subject combat can express today. The owner delegated the choice.

## Decision

- `gunneryTrainingBpFor` (`@bluewave/phase-engine`) returns the ruleset's `training.subjects.GUNNERY.effectBp` once the nation's
  GUNNERY entry has reached `proficiencyMonths`, and zero otherwise, with no program, or with the `fleetManagement` section absent.
- `AutoResolverNation.gunneryTrainingBp` carries it into combat. Projection sets each main battery's existing `training` accuracy
  factor to `10_000 + gunneryTrainingBp` for the battery's own side; the factor was neutral before. The month's auto-resolution and
  the desktop player-battle session both pass it.
- Training stays derived and unstored; stopping the program removes the bonus the same month, as ADR-0316 already resets
  the counter.

## Not delivered

The other three subjects are delivered by ADR-0302. Japan's discount and the exercise tension
consequence have no source figure and ADR-0230 forbids nation-name branches, so they stay with the owner.

## Compatibility

Dormant without the section and neutral without proficient training. The 12 existing replays and all 11 golden hashes verify
unchanged because none fights a battle with proficient gunnery. A replay test shows the same war resolves differently with it.
