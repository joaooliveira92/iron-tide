# ADR-0278: Save files decode strictly, campaign.json included

Applies to: persistence

Rule: Save files decode strictly with `onExcessProperty: "error"`; only the save-header probe stays lenient.

## Status

Accepted (2026-10-23).

## Context

`packages/persistence/AGENTS.md` requires every file it reads to decode with `onExcessProperty: "error"`. Pointer, signature and metadata files followed the default, which strips unmodeled keys. `campaign.json` did too, and a test pinned that behaviour by citing ADR-0155, a legacy record that is unavailable and unverified (see the ADR README). Four hand-written filters in `schemas.ts` rejected exact-key mismatches on nested records only because the default decode could not.

A stripped key in `campaign.json` already fails the load: `rawHash` is computed over the full state at save time and recomputed over the decoded state at load time. Strict decoding therefore changes the diagnostic, not which saves load.

## Decision

1. Pointer, signature and metadata files decode through one reader built on `Schema.fromJsonString` with `onExcessProperty: "error"`.
2. `campaign.json` decodes with `decodeStorableCampaignState`, which applies the same option. The compiler CLI's `campaign:save` uses the same option.
3. The exact-key filters are deleted. A nested `Struct` rejects an excess key itself.
4. The save-header probe stays lenient: it reads only `snapshot.compatibilityVersion` so a save from another compatibility version is refused before decode (BW-PER-001).
5. A field typed `Schema.Unknown` or `Schema.Record(String, Unknown)` still accepts any keys; strictness does not reach into it.

## Consequences

- An unmodeled key in any save file is reported as corrupt or structurally invalid.
- Adding a field to a save format needs the schema change and a parity fixture in the same commit; an older build refuses a newer file's extra keys instead of silently dropping them.
- `schemas.ts` loses four filters and two key-list constants; `StorableDeclinedBattleSchema` and `StorableDeclineCounterSchema` are replaced by the record schemas they wrapped.
- The save-compatibility corpus and every round-trip test pass unchanged apart from the tests that asserted the open behaviour.
