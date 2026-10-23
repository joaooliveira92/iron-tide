# ADR-0275: Exact-duplicate pure helpers live in combat core

## Status

Accepted (2026-10-23). Amends ADR-0271 (its first consequence: duplicated helpers stay behind separate seams).

## Context

ADR-0271 accepted per-seam duplication of `compareStrings` (`air-combat`, `aircraft`, `air-defense`) and `damageMultiplierBp` (`mines`, `air-defense`) so no name could collide at the root. The root no longer exports subsystems, so the collision reason is gone. The three `compareStrings` copies were byte-identical: a codepoint ordering that every canonical sort depends on. Three copies can drift, and a drift would change ordering and hashes in one seam only.

The two `damageMultiplierBp` functions are not copies. Mines maps `OPERATIONAL | DEGRADED | INOPERATIVE` to plain numbers; air defense maps `OPERATIONAL | DAMAGED | DESTROYED` to `SafeInt` using different constants.

## Decision

1. A pure helper that is semantically identical in several seams moves to `src/core/` as one module. Deleting the shared module would force every seam to rewrite it, so the module concentrates real behaviour.
2. `compareStrings` lives in `src/core/ordering.ts`. Seams that already exported it (`air-combat`, `air-defense`) re-export it, so their public symbols do not change.
3. A seam-local copy stays acceptable only where the semantics differ, as with `damageMultiplierBp`. Such helpers are not unified.
4. Tiny helpers such as `clamp` and `clampBp` stay local: their bounds, argument order, or NaN behaviour differ, and none has three identical uses.

## Consequences

- One definition of codepoint ordering; no hash or ordering change.
- The core barrel is unchanged; `core/ordering.ts` is imported by path.
