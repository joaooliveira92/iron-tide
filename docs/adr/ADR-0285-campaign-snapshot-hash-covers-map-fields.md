# ADR-0285: The campaign snapshot hash covers Map fields

Applies to: campaign, persistence

## Status

Superseded by: ADR-0343

Accepted (2026-10-24). Resolves decision request [0043](../../.ai/decision-requests/0043-campaign-snapshot-hash-map-fields.md) with Option A, approved by the owner.

## Decision

1. `canonicalSerialize` is unchanged. `@bluewave/campaign` projects `CampaignSnapshot` through `hashableCampaignSnapshot`, which turns `nations`, `designs`, `designFamilies` and each nation's `research.activeCandidates` into records ordered by code point, before hashing.
2. `hashCampaignSnapshot`, `createCampaignSnapshotEnvelope` and `verifyCampaignSnapshotEnvelope` are the only way to hash, stamp or verify a campaign snapshot. The compiler, the save store, save migration and the desktop turn and project stores use them.
3. Verification also accepts an envelope stamped over the unprojected snapshot (`verifyLegacyMapBlindEnvelope`), so no save written before this change becomes unloadable. A save stamped that way is re-stamped with the new envelope the next time it is written or migrated.

## Consequences

- `initialSnapshotHash` in `golden/hashes.json` moves because the serialized subject now contains the Map contents, which were `{}` before. No other golden hash, ledger hash or replay hash moves.
- A save written after this change that is edited in its nation, design or family state fails envelope verification. A legacy save keeps the earlier, weaker check until it is next written.
- The save-level `rawHash` (`toSaveableState`) is derived from the envelope and so moves with it; it still serializes the unprojected snapshot, which the envelope now guards.
- Removing the legacy path later needs a compatibility-version decision and a migration of existing saves.
