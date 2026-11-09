# Brief: issue #574 accelerate and halt (Option A)

Decision: `.ai/decision-requests/0057-accelerate-cancels-itself-under-capacity-pressure.md` (Option A, Coordinator under owner delegation, 2026-11-08).

## Design decisions (PROVISIONAL balance, all in `content/production/1880/ship-building/balance.ts`)

- One source of truth: `accelerationTermsOf(constructionBalance, costBalance)` in `packages/ship-design/src/accelerationTerms.ts`. Work multiplier is `10000 + costBalance.accelerationCostBp`; time factor is `accelerationTimeBp`; the work rate is derived as `floor(units * workMultiplierBp / timeBp)`, so the net time factor equals `accelerationTimeBp`.
- Pressure model constants moved into `ConstructionBalance`: `accelerationPressureWeightBp`, `accelerationDelayThresholdBp`, `accelerationDelayProbabilityCapBp`, plus the new `accelerationPoolMultipleBp`.
- Pool: `accelerationPoolUnitsOf` = largest per-line yard capacity among the nation's live projects times `accelerationPoolMultipleBp` (30000, three dock-sized hulls). Absolute, not scale-invariant: one accelerated ship gives probability 0, several together give more than 0.
- Pace fix: `isPaced` no longer excludes ACCELERATED. Accelerated projects carry `acceleratedFromMonth` and `acceleratedFromWork`; the remaining months compress by `round(remaining * timeBp / 10000)` from that month, so no catch-up burst.
- Terms are threaded as an optional trailing `terms` parameter; without terms an accelerated project gets no speed-up and no pressure resolution (warn, like the preservation path).
