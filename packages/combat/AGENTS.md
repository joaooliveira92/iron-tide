# @bluewave/combat

**Role:** Deterministic tactical battle engine and auto-resolution.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Uses `random` for all draws; never `Math.random`.

**Invariants:**

- Integer or fixed-point maths only; record every random outcome through the ledger.
- Outcome changes move goldens: follow golden repinning.
- `src/missiles` is surface-to-surface only (ADR-0312, superseded by ADR-0358); values come from the optional `missiles` ruleset block, and without it the module is dormant.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/combat.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/combat test`.
