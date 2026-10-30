# ADR-0251: The fleet screen shows manual p.48 status, assigns foreign station, and reads presence from the projection

Applies to: campaign-engine, desktop

## Status

Superseded by: ADR-0362

Accepted (2026-10-21). Implements ticket [#83](https://github.com/joaooliveira92/iron-tide/issues/83) (S-5 09, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R12). Builds on ADR-0241, ADR-0247 to ADR-0250.

## Decision

1. `buildFleetScreenView` (`@bluewave/campaign-engine`) gains, additively: `shipId` and the p.48 `a` / `S` codes and
   repair month count on each ship row, `overBaseShips`, and `presence`. `presence` comes from the one
   `buildPresenceReadout` shared with the player projection (rules and month supplied by the desktop main process, as for
   `inspectCampaign`); with no rules it is `{ configured: false }`. `L` is never inferred: only `S` is shown, because the
   classification itself is gated (decision request 0026).
2. One new bridge command, `submitStationAssignment` (`intent` `assign` or `clear`, non-empty `shipIds`), queues the
   existing `AssignForeignStation` / `ClearForeignStation` envelope through `submitPlayerCommand`. Eligibility is the
   engine's own validator at issue time; the whole batch is rejected with `STATION_ASSIGNMENT_REJECTED` and per-ship
   reasons, queued nowhere. The renderer decides nothing about eligibility.
3. The renderer words those reasons from catalogue strings (`fleet.*` keys in `strings.ts`), shows every state as code plus
   text, uses native keyboard-operable controls and theme tokens only, and imports no `effect`.
4. The presence readout renders `required`, `present`, `shortfall`, the blockade exemption notice, the dormant 'not
   configured' text and the over-base list from the projection alone. No simulation value is added or defaulted.

## Compatibility

No ruleset, state, schema, wire-of-record or golden change: projection fields are additive and presentation-only, and the
new command reuses frozen engine envelopes. The production pack authors no presence section (#85 is blocked), so the
production screen reads 'not configured'; the readout is covered by fixture-class data in tests.
