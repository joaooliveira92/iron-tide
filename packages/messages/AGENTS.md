# @bluewave/messages

**Role:** Turn interruptions, decision requests, recorded inputs and message aggregation.

**Class:** runtime-free

**Boundary:** Presentation-adjacent projection over authoritative state.

**Invariants:**

- Root rules cover most constraints; the governing ADRs below carry the package-specific ones.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/messages.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/messages test`.
