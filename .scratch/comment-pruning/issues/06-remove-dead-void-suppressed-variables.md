# 06: Remove dead `void`-suppressed variables in the ship-build derivation path

**Type:** implementation

**What to build:** Several `void <identifier>;` statements silence variables that
were never read — in the component-variant, stability-formatting, suggestion
scoring, and construction-cost derivation paths. For each, either consume the
value where the surrounding logic clearly intended to, or delete both the
computation and the suppression.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] No `void <identifier>;` remains in the ship-build derivation sources.
- [x] Every removed variable either has a real consumer or is deleted with its computation.
- [x] Lint and the ship-design test suite pass.

## Comments

Removed the dead computations and their suppressions: `cost` param → `_cost` in
`construction.ts`; the unused `family` lookup in `partCatalogue.ts`; the unused
`fmt` formatter in `stability.ts`; and the `score` destructure in `suggest.ts`
(`({ score: _score, ...fix }) => fix`). Also dropped the unused `balance`/`kg`
imports and `void` statements in `ship-design/test/compile.test.ts`. No
`void <identifier>;` remains in the ship-design sources.

Validated: `vp lint .` 0 errors; `vp run -r --concurrency-limit 4 test` 2053
passed | 1 skipped.
