# @bluewave/cross-process-test

**Role:** Cross-process determinism harness.

**Class:** io-boundary

**Boundary:** Test harness; asserts identical hashes across processes.

**Invariants:**

- A hash that changes without an understood authoritative cause is a stop condition, not a pin to update.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/cross-process-test test`.
