# @bluewave/persistence

**Role:** Content-addressed atomic save/load, snapshots, recovery.

**Class:** io-boundary

**Boundary:** IO boundary: the full `effect` runtime is allowed here, and not listed in the runtime-free gate. Decode every file with a strict schema (`onExcessProperty: "error"`); never `JSON.parse(...) as T`.

**Invariants:**

- Save formats are frozen: schema changes need a parity test from existing fixtures.
- A save from a different compatibility version is refused before decode, never migrated at runtime (BW-PER-001).
- Writes are atomic; recovery must never fabricate canonical data.
- Saves carry a file manifest and one unified snapshot hash; retention keeps active and previous saves.
- No `AbortSignal`; typed failures leave the typed channel only at baseline-frozen sites.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/persistence test`.
