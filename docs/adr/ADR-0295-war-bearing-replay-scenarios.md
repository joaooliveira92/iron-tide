# ADR-0295: A replay scenario may name a player nation and a deterministic start setup so the corpus fights a battle

Applies to: cross-process-test

## Status

Accepted (2026-10-25). Closes the replay-scenario criteria left open on tickets
[#271](https://github.com/joaooliveira92/iron-tide/issues/271) and
[#276](https://github.com/joaooliveira92/iron-tide/issues/276) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265). Builds on the replay corpus of
[ADR-0246](ADR-0246-replay-corpus-supersedes-single-scenario-golden.md) and the approvals of [ADR-0279](ADR-0279-replay-approvals-carry-a-change-class.md).

## Context

The production start has no war, and its ships carry a firepower of 15 to 26 against a battle-generation minimum of 300 per
side. The corpus therefore never produced a battle, so the absence record (ADR-0287) and battle experience (ADR-0292) were
covered only at phase-engine level. Battle absences also need the player nation, which the replay executor did not pass.

## Decision

1. **Player nation.** `engineOptions` of a replay file is a union: `{ kind: "default" }` as before, or
   `{ kind: "player", playerNationId }`. A scenario with `playerNationId` records the second form and the executor passes it
   to the month executor beside the production `fleetManagement` section.
2. **Start setup.** The `initial` block may carry an optional `setup` naming a pure function from the production start
   snapshot to the replay's start snapshot. The only setup is `armed-adriatic-war`: it sets the firepower of the Austro-Hungarian
   and Italian ships to 400 and commissions `aut_tegetthoff`, which stays in work-up. The recorded `snapshotHash` is the hash
   after the setup, so a drifting setup or a drifting production pack both fail verification at month zero.
3. **Scope.** A setup is test scaffolding over the production pack. It never writes to content, so no production balance value
   changes and no owner authorisation is needed. The firepower is a fixture figure, not a balance claim.
4. **Command bodies.** `DeclareWar` and `MoveFleet` join the replay command-body union.
5. **Scenario.** `production-1880-4m-adriatic-war` declares war at month 1 and moves the fleet through `sea_mediterranean_c`
   to `ita_tyrrhenian_coast` by month 2. From month 2 a battle fires each month; its record lists `aut_tegetthoff` as absent for
   `WorkingUp`, and the division gains experience once per battle.

## Compatibility

Additive and optional: existing replay files omit `setup` and decode as `{ kind: "default" }`, and all twelve existing replays
verify byte-for-byte. The replay format version stays 2. A new replay file needs no approval entry; the approval gate reports
no corpus delta.
