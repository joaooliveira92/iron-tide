# ADR-0289: Role and formation changes are one division command priced from the ruleset; speed mismatch is a derived advisory

Applies to: campaign, commands, desktop

## Status

Superseded by: ADR-0357

Accepted (2026-10-25). Implements ticket [#272](https://github.com/joaooliveira92/iron-tide/issues/272) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decision #198. Values are the balance targets of
[ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md); the section is
[ADR-0286](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md).

## Decision

1. **Finding.** The unhandled `CHANGE_ROLE` and `CHANGE_FORMATION` reorganisation reasons had no command that could reach
   them: a division's role and formation were fixed at creation. The ticket therefore adds the command.
2. **Command.** `ChangeDivisionDoctrine` names a division and a role, a formation, or both. It is refused with a typed
   code when the division is unknown, neither field is named, a value is not in the closed role or formation list, or
   nothing would change. Combat's role and formation legality stays where it is and is enforced at battle time, as for
   creation.
3. **Penalty.** `applyDivisionDoctrineChange` (`@bluewave/campaign`) stamps `lastReorganizationMonth`, so cohesion growth
   ([ADR-0288](ADR-0288-monthly-division-cohesion-growth.md)) pauses that month, and subtracts the `reorganisationPenalty`
   cohesion and experience of each field that changed, clamped to 0..100. With the `fleetManagement` option absent the
   change is free; the penalty is read from the ruleset and never from code.
4. **Speed advisory.** `divisionSpeedAdvisory` derives, from the members' ship speeds, the slowest ship and the fastest
   speed when they differ. It is not stored and has no campaign effect; the division screen shows it as a note. No
   threshold is introduced, so no unsourced number is invented.
5. **Presentation.** The division screen projection carries `penalties.changeRole` and `penalties.changeFormation`
   (zero while dormant) and an optional `speedWarning` per division.

## Compatibility

No state shape changes: role, formation, cohesion and experience already exist on the division. A new command body is
additive. The replay body schema is not extended in this ticket; the replay scenario for the penalties lands with the
production authoring of the section (#277).
