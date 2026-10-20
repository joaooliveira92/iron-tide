# @bluewave/ship-design

**Role:** Component-level ship compiler.

**Boundary:** Authoritative, runtime-free. Depends on `armament`, `content-schema`, `random` and foundations.

**Invariants:**

- `approved-diffs.json` is a reviewed record of accepted diffs: never edit it just to silence a failing diff.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/ship-design test`.
