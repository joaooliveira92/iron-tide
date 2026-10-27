# ADR-0317: The annual fleet exercise is scheduled for the next month and held through the assignment slot

Applies to: campaign, commands, desktop, phase-engine

## Status

Accepted (2026-10-25). Implements ticket [#275](https://github.com/joaooliveira92/iron-tide/issues/275) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decisions #199 and #200. Values are the balance targets of
[ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md); the section is
[ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md); the maintenance seam is
[ADR-0316](ADR-0316-special-training-program.md).

## Decision

1. **Command.** `HoldFleetExercise` names ships. Validation reuses the gate evaluator with the `TAKE_MISSION` use, so an
   ineligible ship is refused with its gate code (`FLEET_EXERCISE_REJECTED`, detail `ship=Code`). The calendar-year limit
   and the dormant case are refused with `FLEET_EXERCISE_LIMIT_REACHED` and `FLEET_EXERCISE_DORMANT`, at submit in the
   desktop main process and again in the phase handler.
2. **Timing.** The exercise is held in the month after the command, not in the command month. The command marks the ships
   `EXERCISE` in the assignment slot at once and records `NationState.fleetExercise` (`month`, `year`, `yearCount`,
   `shipIds`, `maintenanceAdderBp`). This makes the cost visible in the treasury projection of the month it is charged:
   the projection reads the same record the month phase reads, so the two cannot differ. The calendar year is the
   year of the exercise month; `yearCount` resets in a new year.
3. **Slot.** `EXERCISE` allows no use (`ASSIGNMENT_ALLOWED_USES.EXERCISE` is empty): the ships cannot sail, fight, hold a
   station or take a mission, and battle absences record `AssignmentForbidsUse`. The station-clear command can release
   only `FOREIGN_STATION`. The fleet screen shows the status code `EX`.
4. **Cost.** In the exercise month an `ACTIVE` ship holding `EXERCISE` pays `(maintenanceMultiple - 1) * 10000` basis
   points more, so twice the active maintenance for the default multiple. `nationMaintenanceAdders` carries it with the
   training adder to the one shared calculator.
5. **Completion.** At the end of readiness evolution in the exercise month, ships are released and each division with an
   exercising ship gains `divisionExperience.perExercise`, clamped to 100, once however many of its ships took part.
   The record stays for the yearly limit.
6. **Not here.** The exercise tension consequence is a gated extension point (S-3/S-4) and is not modelled.

## Compatibility

Additive and optional; the station assignment union gains a member that no existing save holds, and the production pack
does not author the section, so hashes and replays are unchanged and `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264
reasoning). The replay scenario lands with production authoring (#277).
