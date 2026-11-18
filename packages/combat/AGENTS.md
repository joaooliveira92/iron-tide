# @bluewave/combat

**Role:** Deterministic tactical battle engine and auto-resolution.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Uses `random` for all draws; never `Math.random`.

**Invariants:**

- Integer or fixed-point maths only; record every random outcome through the ledger.
- Outcome changes need [replay approvals](../../docs/agents/replay-corpus.md).
- The root export is `resolve`, `advance`, `generate` and the root contract; other modules are subpath seams.
- Optional minute-loop inputs `formation`, `missiles` (surface-to-surface only) and `collision` (ships, terrain; PROVISIONAL rules) change no hash when absent.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/combat test`.
