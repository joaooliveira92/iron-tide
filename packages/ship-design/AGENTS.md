# @bluewave/ship-design

**Role:** Component-level ship compiler.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Depends on `armament`, `content-schema`, `random` and foundations.

**Invariants:**

- `approved-diffs.json` lists reviewed, intentional ship-part output changes and is expected to stay empty; never add an entry just to silence a failing diff.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/ship-design test`.
