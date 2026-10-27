# ADR-0249: Foreign-station ships are routed one hop a month toward the largest shortfall

Applies to: campaign, events, phase-engine

## Status

Accepted (2026-10-21). Implements decision G of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#81](https://github.com/joaooliveira92/iron-tide/issues/81) (S-5 07, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R9, R13). Builds on ADR-0247 and ADR-0248.

## Decision

1. The month-end presence step now returns its non-exempt shortfall rows; `runForeignStationDeploymentStep` consumes
   them right after, so deployment shares the shortfall computation, the exemption and the dormant rule: with the
   `presence` section absent, or the nation exempt, there is no demand and nothing moves.
2. Per nation, the target is the shortfall row with the largest `shortfallTons`, ties by ascending area id. A ship
   with `stationAssignment = FOREIGN_STATION` and `ACTIVE` readiness that is not in any shortfall area of its nation
   moves one hop toward the target; ships are processed in ship-id order against the month's rows (not recomputed
   after each move, so several ships may head for the same area).
3. Routing is a breadth-first hop count over `sea` routes between non-land areas; the next hop is the neighbour one
   hop closer, ties by ascending area id. No path leaves the ship and records `ForeignStationNoRoute`.
4. Only the assigned ship moves. In a multi-ship fleet it is detached into a new single-ship fleet `fleet-fs-<shipId>`
   (`ShipDetachedToFleet`); a ship already sailing alone keeps its fleet. If it is in a permanent division it leaves
   it first through the existing division `remove_ship` rule (flagship succession and its experience/cohesion penalty
   included) and `assertDivisionInvariants` is checked; removing the division's final ship dissolves the division, as
   the existing `RemoveShipFromDivision` rule requires (`ShipRemovedFromDivision`, `divisionDissolved`). Both rules
   are existing; nothing new is chosen, so no decision request was needed. A failed invariant leaves the ship
   unmoved with a `DIVISION_STATE_INVARIANT_FAILED` diagnostic.
5. `fleetMoveProblem` rejects a MoveFleet on a fleet holding an FS ship with `FOREIGN_STATION_ASSIGNED` (validator and
   month apply share it). Clearing the assignment re-enables the order and does not move the ship.
6. New typed events (`ShipDetachedToFleet`, `ShipRemovedFromDivision`, `ForeignStationShipMoved`,
   `ForeignStationNoRoute`) use strict schemas.

## Compatibility

No snapshot, save or wire field of existing data changes; the events are additive and the behaviour needs an authored
`presence` section and an FS-assigned ship, neither of which the production pack has. `CURRENT_COMPATIBILITY_VERSION`
and every golden are unchanged.

## Consequences

- A lone FS ship that covers one area stops being "in a shortfall area" and next month heads for the next-largest
  shortfall; this follows decision G literally and is the AI's (A-1) to manage by assignment, not S-5's.
- Base-limit checks (S-5 08) run after this movement, in the same month-end sequence.
