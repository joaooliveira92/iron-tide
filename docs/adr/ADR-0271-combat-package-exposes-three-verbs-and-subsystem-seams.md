# ADR-0271: The combat package exposes three verbs and subsystem seams

Applies to: combat, phase-engine

Rule: `@bluewave/combat` exports only `resolve`, `advance`, `generate` and the contract types at its root; subsystems are subpath seams.

## Status

Accepted (2026-10-22).

Amended by: ADR-0277 (exact-duplicate pure helpers move to core).

## Context

`@bluewave/combat` had grown to 34 wildcard barrels re-exported from one root.
The interface was the implementation: callers crossed the root to reach any
subsystem, the root carried name-collision patches (`TacticalBattleManifest`,
`compareStrings`, `damageMultiplierBp`), and 273 of 301 test files imported
`../../src/...` directly. Eight modules existed only to satisfy their own tests:
`tacticalPipeline`, `commandReach`, `commandQuantization`, `commandRecord`,
`realism`, `fullSpeedStress`, `battleTurnAway`, and `withdrawal`.

A namespace makes every internal move a change to the caller's import and leaves
no place to state what the package actually does.

## Decision

1. **The root is three verbs and one contract.** `@bluewave/combat` exports
   `resolve`, `advance`, and `generate`, plus the input/result types in
   `src/contract.ts`. It exports no subsystem module and no implementation-only
   value.
2. **Subsystems are subpath seams.** Each subsystem directory is exported as
   `@bluewave/combat/<subsystem>` in `package.json` (`types` points at `src`,
   `default` at `dist`). A seam exists because callers vary across it: player
   battles, gunnery tooling, weather phases, tactical classification, aircraft,
   and carrier operations.
3. **The root aliases the implementation; it does not rename it.** `resolve` is
   `resolveBattleAuto`, `advance` is `advanceMinute`, and `generate` is
   `generateBattles` at the seam. The root facade and the seam cannot drift
   because they are the same function object.
4. **Spec-only modules retire.** The eight modules above, their shared reason
   codes, the `BattleGenerator` pass-through class, and the resolver's duplicate
   `BattleManifest` interface are deleted. A module that only its own test
   imports is not surface.
5. **Tests cross the interface.** Combat tests import `@bluewave/combat` or a
   subpath seam, never `../../src`. The package's Vitest config aliases both to
   `src` so a test run does not depend on a prior build.
6. **The reachability ledger classifies seams.** For `combat`, the classification
   surface is the package `exports` table plus the root facade modules, replacing
   ADR-0267 decision 5's index re-exports and top-level source modules. Every
   seam is classified by exactly one row; retiring or renaming a seam moves its
   row in the same change.

## Consequences

- A name collision cannot reach the root: duplicated helpers stay behind
  separate seams (`compareStrings` in `air-combat`, `aircraft`, and
  `air-defense`; `damageMultiplierBp` in `mines` and `air-defense`), the root
  re-exports none of them, and `BattleManifest` has one definition.
- A new internal module needs no ledger row until it is exported as a seam; a
  new seam fails the ledger gate until classified.
- Consumers name the capability they use, so the dependency direction is visible
  in each import.
- No gameplay, ordering, or hash changes: the verbs are the same functions and
  the retired modules were unreachable from production code.
