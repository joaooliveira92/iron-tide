# 01: Remove dead `void`-suppressed variables left by removed checks

**What to build:** Delete the `void <identifier>;` statements and the dead
variables they silence across the ship-build derivation path (component variants,
stability formatting, suggestion scoring, construction cost). Each value was
never read; the suppression exists only to satisfy the unused-variable rule.
Either consume the value where the surrounding logic clearly intended to, or
remove both the computation and the suppression.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No `void <identifier>;` remains in the ship-build derivation sources.
- [ ] Every removed variable either has a real consumer or is deleted with its computation.
- [ ] Lint and the ship-design test suite pass.
