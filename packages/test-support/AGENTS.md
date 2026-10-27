# @bluewave/test-support

**Role:** Fixture helpers shared by package tests.

**Class:** io-boundary

**Boundary:** Fixtures only.

**Invariants:**

- Fixtures stay deterministic: no wall-clock time, randomness or ambient state.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/test-support.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/test-support test`.
