# D-09: Sidecar-only compatibility stance

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Do the new artifacts change the authoritative save or compatibility version?

## Answer

**Sidecar-only.** `pending-turn.json` and projected turn summaries remain
non-authoritative. Do **not** change the snapshot, hashed event-envelope,
signature, or compatibility version. Existing saves **without** these files must
continue loading normally. Missing summaries may be rebuilt.

A stale or incompatible pending-turn record must **never** be trusted or migrated
speculatively: validate it against the authoritative pre-turn revision and
recorded version identifiers, then either reconstruct it deterministically or
report that resumption is unavailable **without altering authoritative state**.

(Locked round 2, option a.)

## Consequence

Supports existing-save loading and ties into the compatibility rules rather than
weakening them. Drives D-10 (validation invariants), D-14 (`abandonPendingTurn`),
D-15 (recovery surface). Grounded by R-24.
