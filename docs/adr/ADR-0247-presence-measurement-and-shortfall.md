# ADR-0247: Presence is measured at month end from the dormant S-5 section and reported as typed shortfall events

## Status

Accepted (2026-10-21). Implements decisions B and D of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#79](https://github.com/joaooliveira92/iron-tide/issues/79) (S-5 05, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R5, R6, R8 event, R11, R13).

## Context

Manual p.46 requires a minimum naval presence per area. Nothing numeric is sourced (research note
`docs/research/s-5-presence-and-base-limits.md`); decision request 0016 was resolved by the owner as an
ADR-0213 `balance_adjustment` shape with the magnitude deferred to #85, and 0020 (fraction) is still open.

## Decision

1. `measurePresence` (`@bluewave/campaign`) is pure and integer-only. Per nation (id order) and presence area
   (id order, R3) it returns `{ requiredTons, presentTons, shortfallTons }`; `shortfallTons = max(0, required - present)`.
2. Counting: a ship counts only when commissioned, operational, `ACTIVE` and located in the area; reserve,
   mothballed, working-up and repair contribute zero. A ship whose design is not in the snapshot counts nothing.
   Counted kilograms are `floor(displacementKg x w x f)` with `w` = 3/2 for a colonial-service ship on
   `FOREIGN_STATION` (else 1) and `f` = `crampedOrShortRangeCountBp / 10000` when its design is flagged cramped or
   short-range (else 1): one exact product, one rounding. Present tons are the area's summed kilograms floored to tons.
3. Cramped and short-range apply the one fraction once when either holds (0020 leaves combination open). The flags
   are optional `CompiledDesignVersion.crampedAccommodation` / `shortRange`; nothing writes them yet because the
   classification is unsourced (decision request 0026).
4. Requirement (0016): required tons = possessions in the area x `requiredTonsPerPossessionWeight` x `valueWeight`,
   `valueWeight` = level of the nation's highest-level port in the area, else `noPortValueWeight`. "Highest-level
   port" is an engineering reading where an area has several ports. The home area carries a requirement like any
   presence area; decision request 0022 (home-area scope) is open and is applied by S-5 06 with the exemption.
5. The `presence` ruleset section gains the three required values `requiredTonsPerPossessionWeight`,
   `noPortValueWeight`, `crampedOrShortRangeCountBp`; the section stays all-or-nothing and strict (ADR-0242).
6. The month-end step runs in `MonthExecutor` after battle resolution (part of the `battle_resolution` footprint,
   which now also reads `designs`), driven by `MonthExecutorEngineOptions.presence`. Absent = nothing runs. It records
   one `PresenceShortfall` event (nationId, areaId, requiredTons, presentTons, shortfallTons > 0) per shortfall in
   (nation, area) order, and changes no state. The desktop passes `shipBuilding.presence`.
7. `buildPlayerProjection(state, slot, month, presenceRules?)` adds `presence`: `{ configured: false }` when dormant,
   else `{ configured: true, areas: [{ areaId, requiredTons, presentTons, shortfallTons }] }` for the player's nation.

## Compatibility

No snapshot, save or wire field changes: the new design flags are optional and never written, the event is additive,
and the ruleset values live in an optional section the production pack does not author. `CURRENT_COMPATIBILITY_VERSION`
and every golden are unchanged; the cross-process test pins that a configured run's snapshot hash equals the dormant one.

## Consequences

- Authoring the section (#85) is the one change that moves production behaviour; the fixture values in tests never
  reach the pack.
- S-5 06 adds the blockade exemption and penalty requests on top of the shortfall rows; S-5 07/08 reuse the rows.
