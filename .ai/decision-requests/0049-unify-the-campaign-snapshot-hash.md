# Decision Request: Unify the campaign snapshot hash

## Status

Resolved. Option A approved by the owner instruction to complete issues #366-#368
autonomously and recorded as [ADR-0330](../../docs/adr/ADR-0330-unified-snapshot-hash.md).

## Trigger

Three snapshot hashes exist and disagree about what the snapshot is:

- `packages/campaign/src/snapshotHash.ts` hashes the campaign projection
  (`hashCampaignSnapshot`) and is the save envelope's subject.
- `packages/phase-engine/src/replay.ts` hashes a hand-written subset
  (`snapshotToHashable`) that omits designs, design families, prestige rules and
  the player nation.
- `packages/cross-process-test/src/replay-corpus/checkpoint.ts` hashes the whole
  snapshot through a recursive `plain` projection (`fullSnapshotHash`).

The replay subset also serialises a Map as `{}`, so `ResearchState.activeCandidates`
contributes nothing. A replay whose only difference is a design, a design family,
a prestige rule, the player nation or active research candidates passes
verification.

## Evidence

- `packages/campaign/src/snapshotHash.ts` and ADR-0285.
- `packages/phase-engine/src/replay.ts:35-75` (`snapshotToHashable`).
- `packages/cross-process-test/src/replay-corpus/checkpoint.ts:36-38`
  (`fullSnapshotHash`).
- `packages/cross-process-test/src/run-child.ts:138-177` carries a fourth local
  projection; `run-carrier-operations-child.ts` and
  `test/production-pack-loop.test.ts` carry further copies.
- `CampaignSnapshot` in `packages/campaign/src/state.ts:607-626`; its Map-backed
  fields are `nations`, `designs`, `designFamilies` and each nation's
  `research.activeCandidates`.

## Why agent judgment is insufficient

Choosing the hash subject, the domain string, the version and the migration story
moves every snapshot-derived golden, replay checkpoint and metadata hash. The
choice also decides whether legacy saves stay verifiable.

## Options

### Option A: One full-state, versioned, domain-separated hash in `@bluewave/campaign`

- Behavior: a recursive plain projection turns Maps into code-point-sorted
  records and Sets into sorted arrays; an explicit field list covers every
  `CampaignSnapshot` key and a guard test names any missing field. The hash is
  `hashWithContext(serialized, "bluewave/campaign/snapshot/v1")`.
- Advantages: one definition, every authoritative field covered, versioning and
  domain separation explicit, contained in the package that owns the type.
- Risks: every snapshot-derived golden and replay checkpoint moves once.
- Compatibility impact: saved envelopes keep their current projection until the
  save manifest work; replay and golden adopt the unified hash immediately.
- Migration impact: golden re-pin plus replay-corpus approvals; no save migration
  is required because the envelope is unchanged in this step.
- Scope and effort: medium.

### Option B: Make `canonicalSerialize` Map/Set-aware

- Behavior: the serializer itself handles Map and Set everywhere.
- Advantages: fixes the whole class of bug at its source.
- Risks: moves hashes in every package that serialises a Map, a wider surface
  than needed.
- Compatibility impact: broad.
- Migration impact: broad golden and replay re-approval.
- Scope and effort: large.

## Recommendation

Option A. It localises the new hash to the package that owns `CampaignSnapshot`,
keeps the existing save envelope until its own manifest change, and gives the
completeness guard a single explicit subject to check.

## Work safely completed while blocked

None; this decision unblocked issues #366-#368.
