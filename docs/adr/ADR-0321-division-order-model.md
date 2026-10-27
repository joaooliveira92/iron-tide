# ADR-0321: Divisions receive a versioned order model, with stance as a lossless preset

Applies to: combat

## Status

Accepted (2026-10-27). Implements the first engine slice of the T-2 tactical
navigation map (#324) and its resolved division-order decision (#329).

## Context

A player battle accepted the campaign's division stance and a speed percent only.
The manual (pp. 83-85) orders divisions by course or map point, speed, formation,
role, lead division, control and turn-together, and the roadmap T-2 needs that
input before formation keeping, force orders or a battle map can exist. Without
one order model the engine would grow a second input path beside stance.

## Decision

- `@bluewave/combat/orders` owns the runtime-free order contract:
  `DivisionOrderSet { version, divisions }`, and each `DivisionOrder` carries
  `divisionId`, `navigation`, `speed`, `formation`, `role`, `leadDivisionId`,
  `control`, `turnTogether` and `issuedAtMinute`.
- `navigation` is `STANCE { stance }`, `COURSE { headingDeg }` or
  `WAYPOINT { xMetres, yMetres, pauseOnArrival }`. Waypoints are integer metres
  in the battle frame; headings are integer degrees 0-359.
- `speed` is `PERCENT` of the design speed (the legacy stance path), `KNOTS`, or
  one of the five manual presets (`CRUISE`, `TWENTY`, `TWENTY_FIVE`,
  `MAX_MINUS_2`, `SQUADRON_MAX`). Presets resolve from the ship's designed speed
  and, for `SQUADRON_MAX`, the slowest ship in the division.
- `CRUISE` has no authorised fraction. The compiler takes the value as an explicit
  `cruiseSpeedBp` input, and when it is absent returns
  `DIVISION_ORDER_SPEED_PRESET_UNAVAILABLE` instead of inventing one. The 20, 25
  and Max-2 presets are the button labels themselves. Sourcing the cruise fraction
  is a precondition for exposing the presets to the player.
- `compileDivisionOrders` is the single pure compiler from orders to the existing
  per-ship `UnitOrders`. It returns unknown-division, duplicate-order,
  lead-division and missing-waypoint-position issues with stable reason codes; it
  never mutates battle state and never draws randomness.
- The existing stance wire shape remains the only production input in this
  slice. `divisionOrdersFromLegacy` converts it losslessly, so the player battle
  session compiles through the new model while the rendered controls stay
  unchanged. Stance is therefore a preset, not a second engine path.
- Orders take effect at the next minute boundary. Nothing consumes `COURSE` or
  `WAYPOINT` from the UI until the battle-map screen lands; this decision makes
  the engine ready without exposing an inert control.
- Formation, role, lead-division and turn-together fields are carried and
  validated for presence, but they do not alter ship orders until formation
  keeping and the realism permission matrix are implemented. Waypoint arrival,
  pause events and transmission delay remain with the run/pause and force-order
  slices.

## Consequences

- Stance-only battles compile through one model and the existing player-battle
  and auto-resolution parity tests stay green; no golden, replay or compatibility
  version moves.
- The T-2 slices for formation keeping, realism, force orders and the battle map
  have a stable, versioned input and do not need a second order path.
- Exposing course, waypoint or the speed presets requires the battle-map UI and
  the sourced `CRUISE` fraction; until then the engine API has no player route,
  which is recorded by the T-2 map rather than by the reachability ledger because
  player battles already have a reachable row.
