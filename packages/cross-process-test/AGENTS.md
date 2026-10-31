# @bluewave/cross-process-test

**Role:** Cross-process determinism harness.

**Class:** io-boundary

**Boundary:** Test harness; asserts identical hashes across processes.

**Invariants:**

- A hash that changes without an understood authoritative cause is a stop condition, not a pin to update.
- Replay approvals bind one entry to the gate base's exact old and new checkpoint hashes; the validator never composes chains. Stacked slices must land in order or collapse their hops into one direct entry per checkpoint.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/cross-process-test test`.
