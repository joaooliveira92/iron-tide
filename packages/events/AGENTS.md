# @bluewave/events

**Role:** Domain event envelopes, explanation trees, ledger.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Depends on foundations only.

**Invariants:**

- Event schemas are wire formats: changes need a parity test from existing fixtures.
- Event body types derive from their Effect schemas; do not hand-mirror them.
- Parsers freeze decoded events; ledger state cannot be mutated through snapshots.
- Ordering must come from explicit keys, not insertion order.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/events.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/events test`.
