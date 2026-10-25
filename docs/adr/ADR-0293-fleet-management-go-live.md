# ADR-0293: Fleet management goes live in the production pack and in every re-execution path

## Status

Accepted (2026-10-25). Implements ticket [#277](https://github.com/joaooliveira92/iron-tide/issues/277) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265). The values are the balance targets of
[ADR-0283](ADR-0283-fleet-management-values-and-repair-entry.md), which the owner's standing delegation on map #193 makes the
authorisation ADR-0213 requires. The section is [ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md).

## Decision

1. **Authoring.** The 1880 core ruleset carries `fleetManagement` with the ADR-0283 values and a `balance_adjustment`
   provenance that names the manual pages for the sourced values. Removing the section returns the pack to dormant behaviour.
2. **Every path that executes a month passes the section.** The desktop turn transaction already did; this decision adds
   the replay corpus executor (`advance`) and the desktop continuity replay, so a saved turn re-verifies against the same
   rules it was played under. A path that omits the option diverges as soon as a division gains cohesion.
3. **Replays are re-recorded and approved, not re-pinned.** The eleven existing replays move from the second month because
   cohesion grows; each moved checkpoint has an `EXPECTED_GAMEPLAY_CHANGE` approval entry (ADR-0279). The fuzz pin is
   re-recorded locally. A new fourteen-month scenario exercises training, doctrine, the exercise and growth.
4. **Dormancy tests stay.** Each rule keeps a test with the option absent, so retuning or withdrawing the section is safe.

## Compatibility

No state shape changes and `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning). An existing save loads with the
section live. `golden/hashes.json` does not move: its proof compiles a synthetic fixture, not the production pack.
