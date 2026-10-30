# ADR-0303: Training cost differences and exercise tension are generic ruleset data

Applies to: campaign, content-compiler, content-schema, phase-engine, content

## Status

Superseded by: ADR-0357

Accepted (2026-10-25). Resolves the two items [ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md) left unmodelled: Japan's training
discount and the tension consequence of a large exercise. Respects [ADR-0230](ADR-0230-campaign-economy-model.md):
no code branch names a nation. The owner delegated the choice.

## Evidence

The manual (p.53) says Japan pays less for training and that large exercises can raise tensions, with no figure for either. A search of
specialist and general sources (`docs/research/fleet-management-values.md`, section "Training cost and exercise tension") found
qualitative support that the Imperial Japanese Navy drilled hard, including at night, and none that measures a cost or efficiency
difference or a diplomatic reaction in game units. No figure is therefore sourced; both values below are balance targets.

## Decision

1. **Per-nation training cost.** `training.nationCostMultiplierBp` is an optional map from nation id to a multiplier between 5,000 and
   10,000 basis points. `trainingAdderBp` applies it, flooring, to the ruleset's maintenance adder when a subject is first funded, so a
   nation's stored entry keeps the price it was funded at. Nations not listed pay the ruleset adder. The 1880 pack lists
   `japan: 8000`, a fifth off the *added* maintenance only (gunnery 3000 bp becomes 2400 bp), which is a conservative target at LOW
   confidence: the discount can never exceed half the adder and never touches base maintenance. The desktop projection shows the nation's
   own adder.
2. **Exercise tension.** `exercise.tension` is an optional block `{ minShips, increase, ceiling }` (increase 1 to 5, ceiling 1 to 9).
   In the month an exercise is held, if it has at least `minShips` participants, the diplomacy phase raises tension by `increase`, up to
   `ceiling`, with every nation the exerciser is *neutral* toward. Allies, trade partners and enemies are untouched, and the ceiling
   stays below the war level of 10. The diplomacy phase now reads `nations` and `politics` and writes `politics`.
3. **Tension is not authored in the 1880 pack.** No source supports a threshold or step, and any figure would be invented, so the block
   is absent and the consequence is dormant. It is tested through the real month pipeline. Authoring it is a one-line ruleset change
   plus a replay re-approval once a source or an owner target exists.

## Compatibility

The multiplier changes the 1880 content hash, so all thirteen replays were re-recorded; only their `contentHash` moved and every
checkpoint hash is identical, so no approval entry applies. The lock was refreshed deliberately. No state shape changes: the discount is
baked into the stored entry's existing `maintenanceAdderBp`.
