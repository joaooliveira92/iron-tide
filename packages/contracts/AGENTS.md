# @bluewave/contracts

**Role:** Branded `SafeInt` unit types, checked arithmetic, rounding. The graph root.

**Class:** runtime-free

**Boundary:** Authoritative foundation, runtime-free (no `effect` runtime). No `@bluewave/*` dependencies; keep it that way.

**Invariants:**

- Reject non-integers and unsafe integers at construction; never widen to `number` arithmetic.
- Rounding mode is always explicit.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/contracts.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/contracts test`.
