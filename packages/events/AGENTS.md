# @bluewave/events

**Role:** Domain event envelopes, explanation trees, ledger.

**Boundary:** Authoritative, runtime-free. Depends on `campaign` and foundations only.

**Invariants:**

- Event schemas are wire formats: changes need a parity test from existing fixtures.
- Ordering must come from explicit keys, not insertion order.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/events test`.
