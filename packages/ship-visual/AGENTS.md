# @bluewave/ship-visual

**Role:** Presentation-only ship visual parts. See `README.md` for catalog regeneration.

**Class:** runtime-free

**Boundary:** Not authoritative; runtime-free; renderer-only consumer. No runtime dependencies and no `effect`.

**Invariants:**

- Nothing it produces may enter authoritative state or hashes.
- The generated catalog must match `content/ship-visual/parts.yaml`.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/ship-visual test`.
