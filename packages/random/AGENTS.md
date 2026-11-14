# @bluewave/random

**Role:** Domain-separated seeded PRNG with an audit ledger.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Depends on `contracts`, `deterministic`, `diagnostics` only.

**Invariants:**

- No generic `nextRandom()`: every draw takes a hierarchical stream key and records stream, entity key, phase, ruleset version and reason code.
- Adding or reordering draws changes outcomes; re-record replays and approve the change per the [replay corpus](../../docs/agents/replay-corpus.md).

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/random test`.
