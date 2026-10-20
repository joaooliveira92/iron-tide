# @bluewave/phase-engine

**Role:** Ordered monthly turn pipeline (17 phases), replay verifier, ledger.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. The top of the engine graph; composes most other packages. Only `cross-process-test` and the apps depend on it.

**Invariants:**

- The canonical phase order lives in `src/month.ts`; reordering or adding a phase moves authoritative outcomes, so follow golden repinning.
- The replay verifier must reproduce identical hashes.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/phase-engine test`.
