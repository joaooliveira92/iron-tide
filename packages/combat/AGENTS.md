# @bluewave/combat

**Role:** Deterministic tactical battle engine and auto-resolution.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Uses `random` for all draws; never `Math.random`.

**Invariants:**

- Integer or fixed-point maths only; record every random outcome through the ledger.
- Outcome changes move goldens: follow golden repinning.
- The root export is `resolve`, `advance`, `generate` and the root contract; other modules are subpath seams.
- Formation keeping is an optional `formation` minute-loop input; without it every hash is unchanged.
- `src/missiles` is surface-to-surface only, dormant without the optional `missiles` ruleset block.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/combat test`.
