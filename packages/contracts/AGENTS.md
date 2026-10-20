# @bluewave/contracts

**Role:** Branded `SafeInt` unit types, checked arithmetic, rounding. The graph root.

**Boundary:** Authoritative foundation, runtime-free (no `effect` runtime). No `@bluewave/*` dependencies; keep it that way.

**Invariants:**

- Reject non-integers and unsafe integers at construction; never widen to `number` arithmetic.
- Rounding mode is always explicit.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/contracts test`.
