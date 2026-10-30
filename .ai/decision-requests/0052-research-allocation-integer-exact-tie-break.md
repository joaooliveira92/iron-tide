# Decision Request: Make research allocation integer-exact with a stable tie-break

## Status

Blocked pending owner decision.

## Trigger

`largestRemainderAllocation` in `packages/phase-engine/src/research.ts` computes `weight / totalWeight` as floats and sorts remainders with no tie-break. Two fields with equal remainders are ordered by engine sort stability, and float rounding can move a point between fields. `economyPhases.ts` already allocates with BigInt numerators and an explicit index tie-break. Making research match changes authoritative research points, so golden hashes can move (AGENTS.md stop condition: golden hash change, rules change presented as a cleanup).

## Evidence

- `packages/phase-engine/src/research.ts:52-86` (loop and `remainders.sort((a, b) => b[1] - a[1])` at `:75`), used at `:141`.
- `packages/phase-engine/src/economyPhases.ts:36-58`: the exact-integer shape.
- Effect audit #371, ranked item 3: "Decision (golden hash)".
- AGENTS.md "Determinism": integer arithmetic with explicit bounds and rounding; no reliance on insertion order.

## Why agent judgment is insufficient

Whichever tie-break is chosen decides which research field gains a point when remainders are equal. That is a gameplay-visible rule, and any change re-pins goldens and breaks existing replays.

## Options

### Option A: BigInt largest remainder, tie-break by field id ascending

- Behavior: mirror `economyPhases.ts`; ties go to the lexicographically smaller `fieldId`.
- Advantages: order-independent and exact; matches the other allocator's shape.
- Risks: goldens and replay corpus move.
- Compatibility impact: replays recorded before the change no longer verify; compatibility version bump per the save policy.
- Migration impact: re-pin goldens per `docs/agents/golden-repinning.md`, re-record the 13 replays.
- Scope and effort: small code, large verification.

### Option B: BigInt largest remainder, tie-break by authored field order

- Behavior: as A, ties go to the field listed first in the ruleset.
- Advantages: designers control the order.
- Risks: same re-pin; depends on authored order being stable.
- Compatibility impact: same as A.
- Migration impact: same as A.
- Scope and effort: same as A.

### Option C: Leave as is

- Behavior: unchanged.
- Advantages: no re-pin.
- Risks: precision-lossy, order-sensitive allocation stays in an authoritative path.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

Option A, scheduled with the next planned golden re-pin so the hash movement has one cause. Do not implement before approval.

## Work safely completed while blocked

None needed. No research code changed.
