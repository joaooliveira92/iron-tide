# ADR-0292: Battle aftermath asks the division module for experience through a typed request

Applies to: campaign, phase-engine

## Status

Accepted (2026-10-25). Implements ticket [#276](https://github.com/joaooliveira92/iron-tide/issues/276) of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265), decision #203. The seam follows the typed-request style of
[ADR-0248](ADR-0248-blockade-exemption-and-typed-penalty-requests.md) and the prestige seam; values are the balance targets of
[ADR-0314](ADR-0314-fleet-management-values-and-repair-entry.md).

## Decision

1. **Request.** `DivisionExperienceRequest` (`@bluewave/campaign`) carries `nationId`, `divisionId`, a closed reason code
   (`BATTLE_PARTICIPATION`), the source battle id and a non-negative integer number of points.
   `battleExperienceRequests` produces one request per division holding a participating ship, in nation then division
   code-point order. `applyDivisionExperienceRequest` applies it, clamps to 0..100 and refreshes the aggregate hash.
2. **Producer.** After the battle-resolution phase scores prestige, `applyBattleExperience` reads each newly resolved
   battle in id order. Participants are the manifest's persistent assets, or the ships of the battle's fleets when a
   battle has no manifest. Every division of every nation that fought is asked, so the rule is symmetric; each battle is
   resolved once, so each division is credited once per battle.
3. **Record.** Each applied request appends a `DivisionExperienceChanged` event (nation, division, source battle, reason
   code, before, after, delta). A request that changes nothing, such as a division already at 100, emits nothing.
4. **Dormancy.** The points are `divisionExperience.perBattle` of the `fleetManagement` option; without it nothing is
   requested and every hash and replay is unchanged. Experience affects only battle values (combat seeds from the
   division), never campaign movement.

## Compatibility

Additive: a new event kind and no state shape change. The event only appears when the section is authored, so the production
event ledger and replays are unchanged; `CURRENT_COMPATIBILITY_VERSION` stays (ADR-0264 reasoning). The replay scenario with
a battle that grants experience lands with production authoring (#277).
