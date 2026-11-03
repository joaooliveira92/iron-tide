# @bluewave/content-schema

**Role:** Effect `Schema` definitions and the safe YAML parser for packs, rulesets and entities.

**Class:** runtime-free

**Boundary:** Schema definitions only; the compiler in `content-compiler` owns the runtime.

**Invariants:**

- Decode with `{ onExcessProperty: "error" }` at boundaries; wire formats are frozen and every schema change carries a parity test.
- Content YAML carries no executable tags.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/content-schema test`.
