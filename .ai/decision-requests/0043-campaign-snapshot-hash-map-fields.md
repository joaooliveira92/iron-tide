# Decision Request: Campaign snapshot hash does not cover Map fields

## Status

Resolved. Option A approved by the owner and implemented; see [ADR-0285](../../docs/adr/ADR-0285-campaign-snapshot-hash-covers-map-fields.md). `initialSnapshotHash` moved because the serialized subject now contains the Map contents; legacy envelopes remain verifiable.

## Trigger

`canonicalSerialize` is a key-sorting `JSON.stringify`, which serialises a `Map` as `{}`. `CampaignSnapshot.nations`, `.designs`, `.designFamilies` and `ResearchState.activeCandidates` are Maps, so `rawHash` and `envelope.bodyHash` in `packages/campaign/src/compiler.ts:175-177` cover none of that state. Changing a nation's treasury leaves the hash identical.

## Evidence

- `packages/deterministic/src/index.ts:15-33` (`canonicalSerialize`), `packages/campaign/src/state.ts:72,596-601` (Map-typed fields).
- Precedent for projecting Maps before hashing: `phase-engine/src/replay.ts:35-75`, `persistence/src/snapshotSerialization.ts:34`.
- Neither `assert-canonical-serialization.mjs` (raw `JSON.stringify` only) nor the determinism gate detects it.
- Fixing it moves every `rawHash`, `bodyHash` and every consumer of `canonicalSerialize(snapshot)`, including `verifyEnvelope`.

## Why agent judgment is insufficient

Either fix changes authoritative hashes for all snapshots, which needs a compatibility-version decision, golden repin and a migration story for saved envelopes. The choice of where to fix it (campaign-local projection or Map/Set-aware `canonicalSerialize`) also changes the blast radius across packages.

## Options

### Option A: Project Maps to code-point-sorted records in the campaign compiler

- Behavior: `hashableSnapshot(snapshot)` feeds `canonicalSerialize`, `sha256Hex` and `createEnvelope`; `verifyEnvelope` uses the same projection.
- Advantages: contained to campaign; follows existing precedent.
- Risks: other callers of `canonicalSerialize` on Map-bearing values stay silently wrong.
- Compatibility impact: campaign snapshot hashes and envelopes change.
- Migration impact: golden repin; decide whether old saved envelopes remain verifiable.
- Scope and effort: medium.

### Option B: Make canonicalSerialize Map/Set-aware

- Behavior: Maps and Sets serialise as code-point-sorted entries everywhere.
- Advantages: fixes the whole class of bug at its source.
- Risks: moves hashes in every package that serialises a Map, which is a wider surface than the campaign.
- Compatibility impact: broad.
- Migration impact: broad golden repin and replay re-approval.
- Scope and effort: large.

## Recommendation

Option A first, with a compatibility-version bump and an explicit decision on legacy envelopes; consider B afterwards. Do not implement before approval.

## Work safely completed while blocked

None; no code was changed for this item.
