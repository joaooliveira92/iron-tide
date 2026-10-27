# ADR-0241: Foreign-station assignment is optional ship state, orthogonal to readiness

Applies to: campaign, campaign-engine, commands, events, phase-engine

## Status

Accepted (2026-10-20). Implements decisions A and D of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#77](https://github.com/joaooliveira92/iron-tide/issues/77) (S-5 03, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R1, R2, R12 projection, R13).

## Context

S-5 needs a way to mark ships as being on foreign station (manual pp.46-48). The S-1
readiness vocabulary (`ACTIVE`, `RESERVE`, `MOTHBALLED`, `WORKING_UP`, `REPAIR`) already
drives maintenance, crew and battle eligibility, so folding `FS` into it would fork every
S-1 consumer. No value is needed to hold the mark; presence maths, routing and penalties
are later tickets and stay gated behind S-5 01 (#75).

## Decision

1. `Ship.stationAssignment?: "FOREIGN_STATION"` is an optional field, orthogonal to
   `readiness`. A ship holding it is `ACTIVE`; maintenance, crew and battle eligibility
   read `readiness` only, so an FS ship is identical to the same ACTIVE ship.
2. `AssignForeignStation` and `ClearForeignStation` take `{ nationId, shipIds }`. The
   whole command is rejected when any ship is ineligible. `stationAssignmentProblems`
   (`@bluewave/campaign`) returns one typed reason per ship, ordered by ship id:
   `NOT_OWNED`, `UNDER_CONSTRUCTION`, `NOT_OPERATIONAL`, `NOT_ACTIVE`,
   `ALREADY_ASSIGNED`, `NOT_ASSIGNED`, plus `EMPTY_BATCH` and `DUPLICATE_SHIP`. The
   rejection diagnostic is `STATION_ASSIGNMENT_REJECTED` and names every `shipId=REASON`.
   Commands are validated against the month-start snapshot and re-checked at apply time,
   so a stale batch changes nothing.
3. `setShipReadiness` is the single seam for readiness changes: any state other than
   `ACTIVE` clears the assignment. `transitionShipReadiness` (phase-engine) records
   `ShipReadinessChanged` and, when it removed an assignment, one
   `ShipStationAssignmentChanged` with reason `READINESS_LEFT_ACTIVE`. Assign and clear
   record the same event with `ASSIGNED` / `CLEARED_BY_COMMAND`.
4. The fleet projection adds `stationAssignment` and `stationCode: "FS"` (manual p.48),
   present only on assigned ships.

## Compatibility

The field is additive and optional, and the compiler never writes it, so an older save
loads with it absent and the compiled state, snapshot hash and goldens do not move. This
follows the policy in [ADR-0231](ADR-0231-nation-home-area-and-possession-ownership.md):
`CURRENT_COMPATIBILITY_VERSION` stays `3.1.0`. The ticket text asked for a bump; a bump
refuses older saves and contradicts spec #73 story 24, so it is not taken. Ship records
reach `snapshotClone` through an exhaustive field list, which now includes the field.

## Consequences

- No S-1 constant, ruleset value or maintenance rate changes. Nothing here reads a gated
  value (decision requests 0016-0023).
- Nothing in the game yet moves a ship out of `ACTIVE`; the seam is in place and tested so
  that the first producer (a readiness command, repair entry) clears the assignment
  without touching this model.
- Routing (S-5 07), presence (S-5 05) and the fleet-screen controls (S-5 09) consume the
  field and events without changing them.
