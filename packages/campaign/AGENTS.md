# @bluewave/campaign

**Role:** Campaign compiler and state aggregates (world, nations, fleets, war, prestige).

**Boundary:** Authoritative (determinism gate), runtime-free. Has a second export, `./compiler` (`src/compiler-public.ts`). Import siblings via their public `src/index.ts` only.

**Invariants:**

- State-shape changes need a compatibility-version bump and a persistence parity test.
- Vocabulary lives in `GLOSSARY.md` here and in `CONTEXT.md`.
- Compile-time repair is explicit, narrow and logged.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/campaign test`.
