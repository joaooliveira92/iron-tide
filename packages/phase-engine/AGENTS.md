# @bluewave/phase-engine

**Role:** Ordered monthly turn pipeline (20 phases), replay verifier, ledger.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. The top of the engine graph; composes most other packages. Only `cross-process-test` and the apps depend on it.

**Invariants:**

- The canonical phase order is `TURN_PHASES` in `@bluewave/contracts`; `src/phases.ts` composes the implementations in that order, and `MonthPipeline` observes each phase's real reads, writes and RNG use against its declared aggregate permissions. Reordering or adding a phase moves authoritative outcomes, so follow golden repinning.
- The replay verifier must reproduce identical hashes.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/phase-engine.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/phase-engine test`.
