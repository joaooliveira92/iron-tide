# 02: Replace unjustified `as unknown as` double casts with typed construction

**What to build:** The component-variant and persistence sources flip types across
a boundary with `as unknown as`. Replace each with a properly typed value, or a
strict schema decode at the boundary, so the escape hatch and its silent risk
disappear.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No `as unknown as` remains in the ship-design sources.
- [ ] Each former cast site is type-correct without the double assertion.
- [ ] Persistence round-trip and component-variant tests pass; no golden hash changes without an understood cause.
