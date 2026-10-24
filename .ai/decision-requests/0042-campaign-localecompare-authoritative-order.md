# Decision Request: Replace localeCompare in authoritative campaign ordering

## Status

Resolved. Option A approved by the owner and implemented: campaign ordering uses `compareCodePoints` and the determinism gate rejects `localeCompare` and `toLocale*` under `packages/campaign`. Golden hashes, replay corpus and approvals were unchanged. Other packages (`combat`, `commands`, `campaign-engine`) still carry the same pattern and are not yet under the rule.

## Trigger

Twelve authoritative sorts in `packages/campaign` order by `String.prototype.localeCompare`, which consults the host locale and ICU. The determinism gate (`assert-authoritative-determinism.mjs`, `classifyCall`) does not recognise it. Replacing it with `compareCodePoints` could move authoritative order and therefore golden hashes.

## Evidence

- `fleetSize.ts:81,87` uses it as the remainder tie-break for fleet-size flooring.
- `designCompilation.ts:208` takes the sorted first member as `rootDesignVersionId`.
- Other sites: `nationCompilation.ts:190,210,299,320,441`, `worldCompilation.ts:55,65,75`, `politicalCompilation.ts:24,96`, `technologyMaterialization.ts:326`.
- `compareCodePoints` exists in `@bluewave/deterministic` and is already used by `divisions.ts`.
- Against the current 1880 snake-case ids no order difference was observed, so the pinned hashes are expected to hold.

## Why agent judgment is insufficient

If any id outside the observed set sorts differently under code-point order, authoritative outcomes and golden hashes change. A hash move without an understood cause is a stop condition.

## Options

### Option A: Swap to compareCodePoints and close the gate hole

- Behavior: all twelve sorts use `compareCodePoints`; `classifyCall` rejects `.localeCompare(` and `.toLocale*` in authoritative roots.
- Advantages: order no longer depends on host locale; the gate prevents regressions.
- Risks: a hash moves for ids not covered by the current check.
- Compatibility impact: none if `verify-golden-hashes` and the replay corpus are unchanged.
- Migration impact: none if unchanged; otherwise a compatibility-version decision.
- Scope and effort: small.

### Option B: Leave as is

- Advantages: no risk to pinned hashes.
- Risks: latent cross-OS and cross-locale nondeterminism, against the core invariant.

## Recommendation

Option A, gated on `pnpm check:golden`, `verify-replay-corpus` and the replay approvals all passing unchanged. Any movement returns to the owner as a new decision request.

## Work safely completed while blocked

None needed; no code was changed for this item.
