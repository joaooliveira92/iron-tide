# ADR-0287: A battle record explains the player's absent ships with gate reasons

Applies to: campaign, phase-engine

## Status

Accepted (2026-10-25). Implements ticket
[#271](https://github.com/joaooliveira92/iron-tide/issues/271) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decision #201. Builds on
[ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md).

## Decision

1. **Record.** `BattleInstance.absences` is an optional list of `{ shipId, reasons }` (`BattleAbsenceSchema` in
   `@bluewave/campaign`). Reasons are `GateReasonTag` values in evaluator order, entries are in ship-id code-point
   order, and only failed candidates are listed. No prose is stored; the renderer maps tags to text.
2. **Candidates.** A candidate is a ship of the player nation that is not under construction, is in the battle's area,
   and is not a participant of this battle. The candidate set is therefore a function of the manifest, which T-1 owns.
   A ship taken by another battle generated the same month is evaluated as `InBattle`.
3. **Evaluation point.** Absences are evaluated in the battle-generation phase on the pre-reservation snapshot and
   persisted on the record, so later repairs or readiness changes never rewrite them.
4. **Crew quality is not a reason.** Only `ENTER_BATTLE` gates produce reasons; the combat readiness floor is
   unchanged and a poor crew yields a present ship, not an absence.
5. **Dormancy.** Recording runs only when the engine option `fleetManagement` (the decoded ruleset section) is present
   and the player nation is a battle side. The field is omitted when there are no absences. With the section absent the
   state and every replay hash are unchanged.

## Compatibility

Additive and optional. `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning). Battles persist as opaque records, so
the save path needs no change; a round-trip test and a schema parity test cover the new shape.
