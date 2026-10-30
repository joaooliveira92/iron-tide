# ADR-0330: One versioned, domain-separated snapshot hash

Applies to: campaign, phase-engine, cross-process-test, persistence

## Status

Superseded by: ADR-0343

Accepted (2026-10-29). Resolves decision request
[0049](../../.ai/decision-requests/0049-unify-the-campaign-snapshot-hash.md) with
Option A.

## Context

Three incompatible snapshot hashes coexisted. The replay projection omitted
designs, design families, prestige rules and the player nation, and serialised
Map-backed `activeCandidates` as `{}`. The golden child and one acceptance child
carried further copies. A replay that differed only in those fields verified
successfully.

## Decision

1. `packages/campaign/src/snapshotHash.ts` owns the one unified hash.
   `unifiedSnapshotHash(snapshot)` hashes a recursive plain projection in which
   Maps become code-point-sorted records and Sets become code-point-sorted
   arrays, under the domain and version string
   `bluewave/campaign/snapshot/v1`.
2. `SNAPSHOT_HASH_FIELDS` is an exhaustive `Record<keyof CampaignSnapshot, true>`
   and `snapshotHashSubject` names every field explicitly. Adding a field to
   `CampaignSnapshot` fails typecheck until the subject is updated, and
   `missingSnapshotHashFields` lets a named test report the missing field.
3. The replay verifier, the cross-process golden child, the acceptance children
   and the replay corpus use `unifiedSnapshotHash` and nothing else. This removes
   `snapshotToHashable`/`hashSnapshot` from `phase-engine` and the local copies in
   the cross-process package.
4. The save envelope keeps its ADR-0285 projection. The unified hash first enters
   save metadata when the save manifest lands, so this ADR does not change the
   envelope's compatibility contract.
5. Version and domain live in the context string; a future subject change must
   select a new version rather than silently changing the old one.

## Consequences

- `golden/hashes.json` moves for `initialSnapshotHash`, `closingSnapshotHash` and
  `replayVerificationHash`; every replay-corpus monthly checkpoint moves once.
  The commit records the old value, the new value, the cause and a migration
  assessment, with a `Golden-Repin` trailer.
- Replays that differ only in designs, design families, prestige rules, player
  nation or active research candidates now fail verification.
- A field added to the snapshot without updating the hash subject fails a named
  test rather than silently escaping the hash.
- No save becomes unloadable: the envelope path is unchanged until ADR-0331.
