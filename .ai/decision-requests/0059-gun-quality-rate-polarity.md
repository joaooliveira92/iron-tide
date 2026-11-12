# Decision Request: gun_quality_v1 rateBp polarity in the reload product

## Status

Decided 2026-11-11 by the owner's delegate: Option B. The ticket forbids new combat math and wires into the existing `gunQualityMultipliers` consumer only; Option A would add a reciprocal, Option B only changes table values and a field name.

## Trigger

Issue #668 asks to feed per-nation gun quality into the existing `gunQualityMultipliers` consumer with no new combat math. The only consumer of `rateBp` is the `gunQuality` factor of `computeEffectiveReloadMs`, which multiplies it into the reload time in ms. In `GUN_QUALITY_TABLE` a better gun has a larger `rateBp` (+2 is 11000). Fed as-is, +2 quality makes the reload 10 percent longer, so a better gun fires slower and a worse gun (-3 is 8500) fires faster.

## Evidence

- `packages/combat/src/gunnery/constants.ts` `GUN_QUALITY_TABLE`: `"2": { rateBp: 11_000 }`, `"-3": { rateBp: 8_500 }`.
- `packages/combat/src/gunnery/rateOfFire.ts` `computeEffectiveReloadMs`: product of the factors over `10_000^n`, ceiled, is `effectiveReloadMs`.
- `packages/combat/test/gunnery/gun-quality.test.ts` "quality feeds the §4 rate product ... with the correct multiplier" pins reload = ceil(1000 x rateBp / 10000), so +2 gives 1100 ms.
- Production batteries always use `neutralRateFactors()` today (`battleResolution/project.ts`), so the inversion is currently unreachable.
- Prototype (branch `wip/issue-668-combat-wiring`): an optional `gunQuality` input on `projectBattle`/`resolve`/`playerSession` that maps nation and main-gun caliber to a level and sets `rateFactors.gunQuality`. Its test for "a better gun reloads faster" fails with 1100 ms against 1000 ms.
- The ten per-nation value sets are kept on branch `feat/issue-668-gun-quality` (commit 494b32ab), not in this change: authoring them moves the content hash and 13 production replays, and nothing consumes them yet. They are nonzero for most nations, so any wiring changes combat output.

## Why agent judgment is insufficient

Which direction is correct changes gameplay outcomes and either edits a pinned contract (`validateGunQualityContract` fails closed on the table) or adds math the ticket forbids.

## Options

### Option A: Invert at the consumer

- Behavior: the wiring passes the reciprocal factor, `1e8 / rateBp`, so +2 shortens reload to about 909 ms.
- Advantages: the table and its contract stay untouched.
- Risks: new combat math; the `rateBp` name stays misleading.
- Compatibility impact: none for existing hashes (unwired path).
- Migration impact: replays and goldens move once, when the desktop and phase-engine wiring lands.
- Scope and effort: small.

### Option B: Reinterpret the table as a reload-time multiplier

- Behavior: swap the table so a better gun has a smaller `rateBp` (+2 is 9000), and rename the field to `reloadBp`.
- Advantages: one honest meaning, no reciprocal.
- Risks: changes `SHIPPED_GUN_QUALITY_CONTRACT`, its tests and the contract guard; range and penetration columns then run opposite to rate.
- Compatibility impact: contract version bump.
- Migration impact: none today (no production consumer).
- Scope and effort: medium.

### Option C: Defer combat wiring

- Behavior: keep this PR to schema and content only; wire combat in a later ticket after choosing A or B.
- Advantages: no combat or golden change now.
- Risks: values stay inert until then.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

Option B if range and penetration will also be wired (one coherent table); otherwise Option A. Resolution: Option B, with `reloadBp` mapped as `10000 - 500 x quality` (+2 is 9000, -3 is 11500) and `GUN_QUALITY_TABLE_VERSION` set to `gun_quality_table_v2`.
