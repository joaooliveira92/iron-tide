# D-04: Messages are derived, non-authoritative projections

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Are `TurnMessage`s authoritative save state (hashed, replayed), or a derived
non-authoritative projection?

## Answer

**Derived, non-authoritative sidecar.** Domain events remain authoritative.
Turn messages are deterministic, rebuildable projections persisted for efficient
retrieval but **excluded from campaign state hashes**. Each message retains
provenance linking it to its source domain-event IDs, `projectionVersion`, turn
ID, and rules/content versions.

(Locked round 1, option a.)

## Consequence

Message rendering failure is recoverable (never fails an already-persisted month);
summaries are rebuildable by replay (D-11); the frozen `@bluewave/events` wire
format is untouched (D-06).
