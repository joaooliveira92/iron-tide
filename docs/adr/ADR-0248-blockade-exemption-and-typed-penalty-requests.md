# ADR-0248: A blockaded nation at war is exempt from presence, and shortfalls emit typed penalty requests

Applies to: campaign, events, phase-engine

## Status

Accepted (2026-10-21). Implements decisions C and D of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#80](https://github.com/joaooliveira92/iron-tide/issues/80) (S-5 06, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R7, R8, R11, R13). Builds on ADR-0247.

## Decision

1. `isPresenceExempt(snapshot, nationId, month)` (`@bluewave/campaign`) is true when the nation belongs to a war whose
   status is not `ENDED` and is the `blockadedNationId` of a blockade record with `establishedMonth <= month`. Blockade
   determination is unchanged: it only reads records. Either condition alone does not exempt, and the exemption lifts
   the month either ends. The exemption covers every area (decision C); decision request 0022 (home-area scope) stays
   open and Option A (the home area is a presence area, also exempt) is what is built.
2. The month-end step skips an exempt nation entirely: no `PresenceShortfall`, no penalty request. The player projection
   `presence` gains `exempt: boolean` (the exemption notice); an exempt nation's rows keep required and present but show
   shortfall 0.
3. Base-limit checks (S-5 08, R10) are not exempt: they must not call `isPresenceExempt` (contract note on the function).
4. Penalty parameters are the optional ruleset field `penaltyRequests: true` (strict literal, absent = none). It is a
   flag, not a magnitude: magnitudes and the revolt trigger stay gated (decision request 0023) and belong to S-2/S-3.
   With it, each non-exempt shortfall emits, right after its `PresenceShortfall`, one `PrestigeLossRequested` and one
   `RevoltPressureRequested`, each `{ nationId, areaId, shortfallTons }` (integer tons, strict schema, no other field).
   Exactly one of each per nation-area-month, in (nation, area) order.
5. S-5 mutates no prestige, unrest or treasury state; the requests are events only. Consuming them is a dependency on
   S-2/S-3 artifacts.

## Compatibility

Additive event kinds and one optional ruleset field the production pack does not author. No snapshot, save or wire
field of existing data changes; `CURRENT_COMPATIBILITY_VERSION` and every golden are unchanged (cross-process test pins
that the penalty run's snapshot hash equals the dormant one).

## Consequences

- When S-2/S-3 define units, they may add a magnitude field to the requests under their own ADR and parity test.
- The `penaltyRequests` flag is authored (or not) by #85 with the rest of the section.
