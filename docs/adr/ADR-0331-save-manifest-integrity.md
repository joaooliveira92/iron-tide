# ADR-0331: Saves are sealed by a complete-file manifest, not a signature

Applies to: persistence, desktop

## Status

Superseded by: ADR-0343

Accepted (2026-10-29). Resolves decision request
[0050](../../.ai/decision-requests/0050-save-integrity-threat-model.md) with
Option A.

## Context

`campaign.sig.json` held only SHA-256 hashes, so it detected accidental
corruption but proved nothing about who wrote the file. Calling it a signature
overstated the protection and left `metadata.json` and `month-input.json` outside
one integrity artefact.

## Decision

1. A current save directory contains `campaign.json`, `metadata.json`, an
   optional `month-input.json` and `manifest.json`.
2. `manifest.json` is `{ formatVersion, hashVersion, files: [{ name, hash }] }`.
   It lists every file in the save directory except itself, each with the SHA-256
   of its exact bytes. `hashVersion` names the hash algorithm and encoding.
3. Loading reads the manifest first and verifies each listed file before
   decoding. A byte flipped in the campaign payload, the metadata or the month
   input fails with a distinct, player-safe corruption message. A missing or
   unlisted file also fails closed.
4. A save written in the previous format has no manifest. It still loads through
   the legacy signature check and carries one warning that it predates the
   manifest; the next write or migration seals it. The word "signature" is gone
   from new artefacts, diagnostics and player-facing copy.
5. Save, recovery and migration write the manifest atomically inside the save
   directory. A failed migration leaves the original directory recoverable and
   does not publish a partial manifest.

## Consequences

- The protection is complete for accidental corruption and honest in its name.
  Deliberate tampering by a writer who can recompute the manifest is out of
  scope, as the decision records.
- `metadata.monthInputHash` remains as a descriptive field, but the manifest is
  the authoritative integrity record.
- Legacy saves gain one warning instead of silently passing.
