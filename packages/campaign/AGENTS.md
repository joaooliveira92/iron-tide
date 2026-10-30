# @bluewave/campaign

**Role:** Campaign compiler and state aggregates (world, nations, fleets, war, prestige).

**Class:** runtime-free

**Boundary:** Authoritative (determinism gate), runtime-free. Has a second export, `./compiler` (`src/compiler-public.ts`). Import siblings via their public `src/index.ts` only.

**Invariants:**

- Authoritative state-shape changes carry a compatibility-version bump and a schema parity test from existing fixtures.
- Vocabulary lives in `GLOSSARY.md` here and in `CONTEXT.md`.
- Compile-time repair is explicit, narrow and logged.
- Turn identity is fixed from pre-execution inputs before any interruption is answered; campaign reopen goes through a main-process allow-list with canonical-path approval.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/campaign test`.
