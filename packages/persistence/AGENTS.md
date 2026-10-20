# @bluewave/persistence

**Role:** Content-addressed atomic save/load, snapshots, recovery.

**Boundary:** IO boundary: the full `effect` runtime is allowed here, and not listed in the runtime-free gate. Decode every file with a strict schema (`onExcessProperty: "error"`); never `JSON.parse(...) as T`.

**Invariants:**

- Save formats are frozen: schema changes need a parity test and a migration assessment.
- Writes are atomic; recovery must never fabricate canonical data.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/persistence test`.
