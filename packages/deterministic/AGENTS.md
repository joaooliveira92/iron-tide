# @bluewave/deterministic

**Role:** Canonical JSON, SHA-256 domain-separated envelopes, fixed-point maths.

**Class:** runtime-free

**Boundary:** Authoritative foundation, runtime-free. May depend only on `contracts` (plus `@noble/hashes`).

**Invariants:**

- Changing canonical encoding or key ordering moves every hash: treat it as a compatibility change and follow golden repinning.
- Never rely on JS insertion order.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/deterministic test`.
