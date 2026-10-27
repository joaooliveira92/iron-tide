# @bluewave/campaign-engine

**Role:** Desktop read-only projections plus the `campaign:execute` bridge.

**Class:** runtime-free

**Boundary:** Authoritative-gated and runtime-free; it is renderer-reachable. Never import `effect` runtime symbols or `persistence`.

**Invariants:**

- Projections are read-only views and must not mutate or re-derive authoritative state.
- The desktop renderer imports this package, so keep exports free of Node and filesystem capabilities.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/campaign-engine.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/campaign-engine test`.
