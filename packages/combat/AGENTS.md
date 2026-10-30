# @bluewave/combat

**Role:** Deterministic tactical battle engine and auto-resolution.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Uses `random` for all draws; never `Math.random`.

**Invariants:**

- Integer or fixed-point maths only; record every random outcome through the ledger.
- Outcome changes move goldens: follow golden repinning.
- The root export is exactly `resolve`, `advance`, `generate` and the root contract; every other module is a subpath seam.
- `src/missiles` is surface-to-surface only; values come from the optional `missiles` ruleset block, and without it the module is dormant.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/combat test`.
