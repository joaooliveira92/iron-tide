# Decision Request: Save integrity threat model

## Status

Resolved. Option A approved by the owner instruction to complete issue #369
autonomously and recorded as
[ADR-0331](../../docs/adr/ADR-0331-save-manifest-integrity.md).

## Trigger

`campaign.sig.json` is called a signature but holds only plain SHA-256 hashes of
the save files. It provides accidental-corruption detection, not authenticity:
anyone who can edit a save can recompute the hashes. Naming it a signature
overstates what the player is protected from. The file set is also incomplete:
`metadata.json` and `month-input.json` are not covered by one artefact.

## Evidence

- `packages/persistence/src/store.ts` writes `campaign.sig.json` with
  `serializedHash`, `stateHash` and `compatibilityVersion`.
- `packages/persistence/src/saveMigration.ts` rewrites the same file.
- `packages/persistence/src/recovery.ts` only rewrites the pointer.
- `packages/persistence/test/remediation.test.ts` asserts the signature wording
  and the three-file save directory.
- `month-input.json` is guarded only by `metadata.monthInputHash`, and metadata
  itself is unguarded.

## Why agent judgment is insufficient

The decision selects the security claim the product may make. A real signing
scheme introduces key management, portability and recovery costs that were never
approved, while continuing to call hashes a signature is a false claim.

## Options

### Option A: One manifest of plain hashes, no signature claim

- Behavior: `manifest.json` lists every file with its SHA-256 hash, the format
  version and the hash version. Loading verifies the manifest before decoding.
  Legacy saves without a manifest load with a warning that they carry no
  independent integrity check. The word "signature" is removed from artefacts,
  diagnostics and player copy.
- Advantages: honest about accidental-corruption protection; covers campaign,
  metadata and month input in one artefact; no key material.
- Risks: does not resist deliberate tampering by someone who can rewrite the
  manifest too.
- Compatibility impact: new save format; legacy saves remain loadable.
- Migration impact: saves are rewritten with a manifest on their next write or
  migration; no bulk migration.
- Scope and effort: medium.

### Option B: Real signing with an application-held key

- Behavior: the manifest is signed with a key shipped in or derived by the app.
- Advantages: detects edits by a player who cannot obtain the key.
- Risks: a key shipped with the application is not a secret; key rotation,
  loss and cross-platform support are new subsystems and a large scope increase.
- Compatibility impact: new save format plus key lifecycle.
- Migration impact: large.
- Scope and effort: large.

## Recommendation

Option A. It delivers the complete-file integrity the ticket asks for without
claiming authenticity the product does not provide.

## Work safely completed while blocked

None; this decision unblocked issue #369.
