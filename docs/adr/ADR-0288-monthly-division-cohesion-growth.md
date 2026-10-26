# ADR-0288: Division cohesion grows monthly through a pure rule applied after readiness evolution

## Status

Accepted (2026-10-25). Implements ticket [#273](https://github.com/joaooliveira92/iron-tide/issues/273) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decision #203. Values are the balance targets of
[ADR-0283](ADR-0283-fleet-management-values-and-repair-entry.md); the section is
[ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md).

## Decision

1. **Rule.** `growDivisionCohesion` (`@bluewave/campaign`) returns the division unchanged unless it was not reorganised in
   the current month and every ship in its order is `ACTIVE`, operational (not under construction, not `UNAVAILABLE`) and
   present. Otherwise cohesion rises by `divisionCohesion.monthlyGrowth`, never above `divisionCohesion.cap`, and never
   lowered when already above the cap. The aggregate hash is recomputed. There are no random draws.
2. **Placement.** The step runs at the end of `applyReadinessEvolution`, so a ship that finishes working up this month
   already counts as `ACTIVE`, and the step reads the readiness the rest of the month will see.
3. **Battle** does not stop growth; a division that fought still grows.
4. **Dormancy.** The step runs only when the `fleetManagement` engine option is present. With the section absent no
   division changes and every replay hash is unchanged.

## Compatibility

No state shape changes; `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning).
