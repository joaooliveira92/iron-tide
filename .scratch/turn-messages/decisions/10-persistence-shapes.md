# D-10: Persistence file shapes & validation invariants

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What are the exact sidecar shapes and their validation invariants?

## Answer

**`pending-turn.json`** (non-authoritative):

```
{ schemaVersion, projectionVersion, turnId, campaignId, playerNationId,
  startingRevision, rulesetVersion, compatibilityVersion, contentHashes,
  committedOrderHash, recordedInputs[], nextInterruptionOrdinal, createdAt }
```

where `recordedInputs[] = { ordinal, kind: "decision"|"battle", interruptionId,
payload, inputHash }`.

**`turn-summaries.json`**: entries keyed by `turnId`, each carrying
`projectionVersion`, source domain-event ids, entity/effect refs, and
ruleset/content versions.

**Invariants:** strict decode (`onExcessProperty:"error"`); `startingRevision`
must equal the authoritative revision, and `campaignId`/versions/hashes must match
the loaded save. On any mismatch: **never trust or migrate** — reconstruct
deterministically from the pre-turn snapshot, or report resumption-unavailable,
and never mutate authoritative state. Atomic write + tolerant read, matching
`monthlyReports.ts`.

(Locked round 3.)

## Consequence

Grounded by R-24. Consumed by D-09, D-12, D-14.
