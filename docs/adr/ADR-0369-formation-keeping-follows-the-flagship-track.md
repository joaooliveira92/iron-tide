# ADR-0369: Divisions keep formation by following the flagship's track, behind an optional input

Applies to: combat

Rule: Formation keeping is an optional `formation` input to the minute loop; without it no ship steers to a station and every hash is unchanged, and with it line-ahead followers steer to the point on the flagship's recorded track one column interval behind, other formations steer to flagship-relative stations, the ordered division speed is clamped to the slowest ship's attainable speed, and every ship's station is recorded each minute.

## Status

Accepted (2026-10-30).

Amends: ADR-0358

## Context

Resolved decision #328 chose how divisions turn, and the order model (ADR-0358 rule 8) already carries formation and turn-together. The engine nevertheless never steered a ship to a station: `computeDesiredStation` and `helmSteerToStation` were called only by a test, so a division of several ships moved as independent ships. Wiring formation keeping unconditionally would move every golden and replay hash.

## Decision

1. **Optional input.** `AdvanceMinuteInput` and `AdvanceMinutesInput` take `formation?: FormationContext { ruleset, turnTogether, tracks }`. Without it the propulsion stage is byte-for-byte what it was, so no golden, replay or compatibility version moves. `advanceMinutes` feeds each minute's `formationTracks` into the next minute.
2. **Divisions come from battle state.** `TacticalBattleState.divisions` supplies formation, flagship and member order. A division with fewer than two ships on the field, or whose flagship is absent, is not steered.
3. **Line ahead follows the track.** `@bluewave/combat/formation` keeps a bounded history of integer flagship positions, one per one-second substep, capped by `trackCapacity`. A follower steers to the point on that track at path distance `ordinal x columnIntervalUm` behind the head, aiming one station tolerance further along so the bearing never flips on rounding. Beyond the oldest sample the track extends straight back along its oldest segment, or along the reciprocal of the flagship heading when there is only one sample, so a column that starts formed stays formed.
4. **Turn together is opt-in.** With `turnTogether` set for a line-ahead division, followers adopt the flagship's ordered heading while the flagship is still turning, then steer to flagship-relative stations. The default is succession.
5. **Other formations.** Line abreast, search line and screen steer to a station computed from the flagship's position and heading with ruleset intervals; the search line interval must exceed the abreast interval. Screen keeps the column offset plus the division gap used by the earlier station maths.
6. **Speed trimming.** The ordered division speed is the flagship's order clamped to the minimum attainable speed of every ship, taken from each ship's `attainableMaxBp` or, when the order omits it, from its designed speed. A follower behind its station may exceed the division speed by up to `catchUpMarginBp` in proportion to its along-track error, capped at its own maximum, and one ahead slows by the same rule. A division ordered to its maximum therefore has no margin and spreads out.
7. **Off station.** Each minute records one `ShipStationRecord` per steered ship with mode (`FLAGSHIP`, `TRACK`, `STATION`, `TURN_TOGETHER`), `offStation` against `stationToleranceUm`, the error in whole metres and the division speed. The records enter the minute hash only when the input is present, and they are the input to separation (#337) and the read model (#334).
8. **Integer maths only.** Distances are compared at metre scale and bearings are the direction-table heading that maximises the dot product, so no floating trigonometry or unsafe squares are involved. Square roots are of exact integers.
9. **Ruleset values are PROVISIONAL.** Intervals, tolerance, track capacity, catch-up margin and catch-up full error are unsourced (ADR-0252, superseded by ADR-0345) and arrive as caller input validated by `validateFormationKeepingRuleset`; moving them into the dormant `navigation` ruleset section belongs to the machinery slice (#331). Per-class turning rate is not changed here: the flat rate stays until content exists.

## Consequences

- Nothing in production passes `formation`, so player battles, the auto resolver, all goldens and all replays are unchanged until a caller opts in.
- The player battle session can adopt formation keeping by supplying a ruleset and the division's turn-together order with no engine change.
- The separation draw (#337), collision (#335) and the read model (#334) can build on the per-minute station records.
- Role and AI behaviour (#332) is untouched and stays with its prototype.
