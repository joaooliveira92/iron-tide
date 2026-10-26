# ADR-0296: Ship conditions are derived predicates the fleet view carries and the renderer only labels

## Status

Accepted (2026-10-25). Delivers stories 14, 15 and 44 of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265) from decision
[#195](https://github.com/joaooliveira92/iron-tide/issues/195), left open by the go-live report
(`.ai/reports/fleet-management-v2.md`). Follows [ADR-0221](ADR-0221-structured-explanation-data.md): the domain emits data,
presentation renders text.

## Decision

1. **Predicates.** `deriveShipConditions` (`@bluewave/campaign`) returns an ordered subset of the closed list
   `UnderStrength`, `Detached`, `Damaged`, `OutOfAction`. A hull under construction has none.
   - `UnderStrength`: crew quality below the ceiling of the ship's own readiness state.
   - `Detached`: the ship holds a foreign-station assignment. An exercise is not a detachment.
   - `Damaged`: hit points below the maximum, or `availability` of `DEGRADED`.
   - `OutOfAction`: `availability` of `UNAVAILABLE`, or readiness `REPAIR`; one condition for both mechanisms, as decided in #195.
2. **No stored state.** Conditions are computed on read from existing ship fields. Crew ceilings, the monthly ramp and the
   maintenance multiplier stay owned by the primary readiness state; a condition never changes them. No wire format or
   compatibility version changes.
3. **View.** `FleetShipView.conditions` carries the list and is omitted when empty, so existing views are unchanged. The
   renderer labels each code through the message catalogue (`fleet.condition.*`) and never recomputes a rule.
4. **Absence reasons.** The battle history renders gate reason codes through `fleet.absence.*` and `battle.history.absent*`
   catalogue keys instead of a private label map, so a locale catalogue can translate them (story 44).

## Not decided here

The "detached by division detail" half of #195's `detached` predicate has no stored marker and is not derived; a ship pulled
out of its division simply stops appearing in that division. A threshold below which a ship counts as understrength is not
introduced: the ceiling of its state is the only reference, so no gameplay number is added.
