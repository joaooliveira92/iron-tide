# ADR-0286: Ship use is decided by one gate evaluator; fleet-management values live in a dormant ruleset section

## Status

Accepted (2026-10-24). Implements ticket
[#268](https://github.com/joaooliveira92/iron-tide/issues/268) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decisions #196 and #199. Values are the balance
targets of [ADR-0283](ADR-0283-fleet-management-values-and-repair-entry.md); the section pattern is
[ADR-0253](ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md).

## Decision

1. **One pure evaluator** (`evaluateShipGates` in `@bluewave/campaign`) returns the ordered list of failed gates for a
   ship and a use (`SAIL`, `ENTER_BATTLE`, `HOLD_STATION`, `TAKE_MISSION`). Each reason is `{ _tag }` from a closed set
   (`GATE_REASON_TAGS`). There is no weight or threshold; the explanation is the list.
2. **Callers.** Fleet movement and foreign-station assignment read their reasons from the evaluator and keep their
   existing problem codes, so behaviour is unchanged. Battle generation (absences) and the readiness command adopt it in
   their own tickets.
3. **Assignment slot.** `ASSIGNMENT_ALLOWED_USES` declares which uses an assignment kind still allows. `FOREIGN_STATION`
   allows `ENTER_BATTLE` only, which is the sail refusal movement already enforced.
   **Extension point for W-1.** A new assignment kind (trade protection, raider) is added in three places only:
   the `StationAssignment` union in `stationAssignment.ts`, its entry in `ASSIGNMENT_ALLOWED_USES` (which uses it
   still allows), and its replay-body and command wiring. A ship holds at most one assignment because the slot is a
   single optional field; a second assignment is refused with the typed `ALREADY_ASSIGNED` station reason, and the
   gates report `Assigned` for `HOLD_STATION` and `TAKE_MISSION`. Divisions carry no mission field.
4. **Dormant section.** An optional ruleset field `fleetManagement`, decoded strictly by `decodeFleetManagementRules`
   (`@bluewave/content-schema`) with excess keys rejected: division cohesion growth and cap, division experience per
   battle and exercise, role and formation change penalties, training proficiency months, subject limit and per-subject
   adders and effects, exercise maintenance multiple and yearly limit, and `provenance`. Invalid sections fail validation
   with `FLEET_MANAGEMENT_RULES_INVALID`; two carriers with `FLEET_MANAGEMENT_RULES_AMBIGUOUS`. Absent means dormant and no
   default exists in code. `fleetManagementFromRulesets` is the consumer seam.

## Compatibility

Additive only. The section is absent from the production pack, so the content hash, goldens and all ten production replays
are unchanged (verified). No state shape changes, so `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning).
