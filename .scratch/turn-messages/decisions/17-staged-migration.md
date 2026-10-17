# D-17: Staged migration of `MonthExecutor.execute()` (no flag-day)

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

How is the synchronous `MonthExecutor.execute()` migrated to interruption support
without a flag-day rewrite?

## Answer

Six **additive** stages, each independently gate-green:

1. Add an additive interruption/input channel + `suspended` outcome to
   `MonthResult`; with no interruptions the output is **byte-identical** (existing
   goldens untouched).
2. Wire the first seam at `battle_resolution` with default auto-resolve preserved.
3. Add one deterministic decision seam backed by a **test** decision (S-4 replaces
   content later).
4. Add `resolveTurn`; delegate `commitMonth`.
5. Add projection + summary sidecar as a post-turn step.
6. Add renderer surfaces.

The delivery-stage names (`M1`…`M5`) in the map address these to S-4/T-1. Stage
`M2` is the interruption seam that unblocks S-4 and T-1.

(Locked round 3.)

## Consequence

Consumed by D-02, D-08, D-19. Grounded by R-21/R-20.
