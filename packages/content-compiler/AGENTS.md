# @bluewave/content-compiler

**Role:** Parse, validate, normalize, compile stages with diagnostics.

**Class:** io-boundary

**Boundary:** IO boundary: full `effect` runtime allowed. Stages are statically ordered, immutable, and free of ambient I/O, randomness and final-artifact writes.

**Invariants:**

- Accumulate diagnostics and block downstream stages whose prerequisites failed.
- Keep validation, normalization and repair distinct.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/content-compiler.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/content-compiler test`.
