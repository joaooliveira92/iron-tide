# @bluewave/campaign-engine

**Role:** Desktop read-only projections plus the `campaign:execute` bridge.

**Boundary:** Authoritative-gated and runtime-free; it is renderer-reachable. Never import `effect` runtime symbols, Node APIs or `persistence`.

**Invariants:**

- Projections are read-only views and must not mutate or re-derive authoritative state.
- Anything reaching the renderer must be IPC-serializable.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/campaign-engine test`.
