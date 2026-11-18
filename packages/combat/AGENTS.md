# @bluewave/combat

**Role:** Deterministic tactical battle engine and auto-resolution.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Uses `random` for all draws; never `Math.random`.

**Invariants:**

- Integer or fixed-point maths only; record every random outcome through the ledger.
- Outcome changes need [replay approvals](../../docs/agents/replay-corpus.md).
- The root export is `resolve`, `advance`, `generate` and the root contract; other modules are subpath seams.
- Optional inputs `formation`, `missiles`, `collision` change no hash when absent; `division-ai` is dormant, its memory an explicit input and output.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/combat test`.
