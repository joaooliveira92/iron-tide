# @bluewave/phase-engine

**Role:** Ordered monthly turn pipeline (17 phases), replay verifier, ledger.

**Boundary:** Authoritative, runtime-free. The top of the engine graph; composes most other packages. Nothing in `packages/` may depend on it except `cross-process-test`.

**Invariants:**

- Phase order is part of the ruleset; reordering or adding phases is a compatibility change.
- The replay verifier must reproduce identical hashes.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/phase-engine test`.
