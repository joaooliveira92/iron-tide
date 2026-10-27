# ADR-0250: Base limits are checked last each month; over-base ships are flagged and take the S-1 consequences

Applies to: content-schema, campaign, phase-engine

## Status

Accepted (2026-10-21). Implements decision E of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#82](https://github.com/joaooliveira92/iron-tide/issues/82) (S-5 08, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R10, R11, R13). Builds on ADR-0247 to ADR-0249 and ADR-0223.

## Context

Manual p.45: the ships deployable in an area depend on the area's base value; more may be deployed at the cost of
maintenance problems and reduced crew quality; no bases means a very limited number; limits are checked at the end of the
turn after battles. The mapping, the no-base number, the occupying states and the consequence magnitudes are unsourced
(decision requests 0017, 0018, 0019, all open), so only their shape is built; every value is an optional ruleset input.

## Decision

1. The `presence` ruleset section gains an optional all-or-nothing `baseLimits` block: `limitByBaseLevel` (one integer
   per port level 1..`PORT_LEVEL_MAX`), `noBaseLimit`, `occupyingStates` (non-empty, unique S-1 states),
   `maintenanceAdderBp` and `crewQualityReduction` (0..100). No default exists. Absent block = base limits dormant even
   when the rest of the section is authored.
2. `measureBaseLimits` (`@bluewave/campaign`) is pure and integer-only. Per nation and area it counts commissioned,
   operational ships whose readiness is occupying; the limit is the table entry for the nation's best port level there
   (the same "highest-level port" reading as ADR-0247), else `noBaseLimit`. The ships beyond the limit are the later
   ones in ascending ship id: a canonical, storage-order-free choice, not a gameplay ranking.
3. The month-end `runBaseLimitStep` runs as the `base_limits` phase last (after `battle_resolution`,
   `presence_measurement` and `foreign_station_deployment`; ADR-0272), so a
   fleet fights at full strength the month it arrives. It reads no war or blockade and never calls `isPresenceExempt`
   (ADR-0248 item 3). Flagged ships get `Ship.overBase = { maintenanceAdderBp }` and lose `crewQualityReduction` through
   the S-1 `reduceCrewQuality`; a ship no longer over loses the flag. It repeats every month while the ship stays over;
   the S-1 crew ramp recovers a point at a time in between.
4. The maintenance consequence goes through the S-1 maintenance seam: `shipMonthlyMaintenanceCost` takes an optional
   adder (one extra floor rounding), and `nationMonthlyMaintenance` reads it from `Ship.overBase`, so the phase, the
   economy outlook and the projection charge the same figure from the month after the flag. The flag carries the adder so
   no consumer needs the ruleset. No numeric literal is added to phase or projection code.
5. The player projection ship rows and the fleet screen carry `overBase` (and the manual's `*` code); absent otherwise.
6. No new event kinds: the flag and consequences are visible in state and projection. A typed flag-change event can be
   added later with its own parity test if a consumer needs it.

## Compatibility

`Ship.overBase` is optional and written only by the step when an authored block flags a ship; the compiler never writes
it and the production pack authors no section. `CURRENT_COMPATIBILITY_VERSION` and every golden are unchanged
(cross-process test: a presence run without the block equals the dormant snapshot hash).

## Consequences

- Authoring the block (#85, after decision requests 0017 to 0019) is the change that moves production behaviour.
- A save written after a flag was set carries `overBase`; older readers ignore nothing because the field is additive.

Amended by: ADR-0272 (the month-end step becomes its own `base_limits` phase).
