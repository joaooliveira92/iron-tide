# ADR-0316: Special training is a nation program whose maintenance adder feeds the shared calculator

Applies to: campaign, commands, desktop, phase-engine

## Status

Superseded by: ADR-0357

Accepted (2026-10-25). Implements ticket [#274](https://github.com/joaooliveira92/iron-tide/issues/274) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decision #200. Values are the balance targets of
[ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md); the section is
[ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md).

## Decision

1. **State.** `NationState.specialTraining` is an optional list of `{ subject, fundedMonths, maintenanceAdderBp }` in
   canonical subject order, at most the ruleset's `maxSubjects` long. The adder is copied from the ruleset when a subject
   is first funded, as `prestigeRules` is carried in the snapshot, so every reader of the maintenance calculator
   (month phase, treasury projection, briefing, commitments) sees the same number without needing the ruleset.
2. **Command.** `SetSpecialTraining` replaces the funded subject set. A kept subject keeps its months; a dropped
   subject is gone immediately, and funding it again starts at zero. Validation refuses unknown or repeated subjects.
   The limit and the dormant case are refused with typed codes (`TRAINING_SUBJECT_LIMIT_EXCEEDED`, `TRAINING_DORMANT`)
   at submit time in the desktop main process, and again by the phase handler as a diagnostic.
3. **Counter.** At the end of readiness evolution each funded subject gains one funded month, stopping at
   `proficiencyMonths`. Proficiency is `fundedMonths >= proficiencyMonths`; it is derived, not stored.
4. **Maintenance.** `nationMonthlyMaintenance` and `fleetMaintenanceBreakdown` take the summed adder and add it, in basis
   points, to the monthly cost of `ACTIVE` ships only, on top of any over-base adder. There is no new ledger line.
5. **Not in this ticket.** Applying proficiency to battle values. The ruleset's `effectBp` is carried but unread; the
   manual gives effects for gunnery and night fighting only and the rest are gated values.

## Compatibility

Additive and optional; absent from every existing save and from the production pack, so state hashes and replays are
unchanged and `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning). The replay body schema is not extended; the
replay scenario lands with production authoring of the section (#277).
