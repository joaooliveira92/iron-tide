# ADR-0358: Combat engine architecture

Consolidates: ADR-0271, ADR-0277, ADR-0308, ADR-0312, ADR-0321, ADR-0322

Applies to: armament, combat, content, content-schema, phase-engine, ship-design

Rule: `@bluewave/combat` exports exactly `resolve`, `advance`, `generate` and the root contract; all subsystems, orders, realism and combat modules are subpath seams.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0271
Supersedes: ADR-0277
Supersedes: ADR-0308
Supersedes: ADR-0312
Supersedes: ADR-0321
Supersedes: ADR-0322
Amended by: ADR-0369 (rule 8: formation keeping is an optional minute-loop input).

## Context

`@bluewave/combat` had grown from a flat namespace with 34 wildcard barrels re-exported from one root. The interface was the implementation: callers crossed the root to reach any subsystem, the root carried name-collision patches, and 273 of 301 test files imported `../../src/...` directly. Eight modules existed only to satisfy their own tests. Exact-duplicate pure helpers (`compareStrings`) lived in three seams and risked drift, while helpers with differing semantics (`damageMultiplierBp`) correctly stayed separate. Meanwhile, compiled design capabilities stopped at the compiler—combat never received them, so a `damage_control` part could not affect a battle. The manual described missile combat, division orders and a realism permission matrix, but the engine had no implementation for any of them, and the roadmap (T-2 tactical navigation, formation keeping, rank-gated targeting) required each before the battle-map screen could land.

## Decision

1. **Root is three verbs and one contract.** `@bluewave/combat` exports `resolve`, `advance`, and `generate`, plus the input/result types in `src/contract.ts`. It exports no subsystem module and no implementation-only value. Root aliases the implementation—`resolve` is `resolveBattleAuto`, `advance` is `advanceMinute`, and `generate` is `generateBattles`—so the facade and the seam cannot drift.

2. **Subsystems are subpath seams.** Each subsystem directory is exported as `@bluewave/combat/<subsystem>` in `package.json`. A seam exists wherever callers vary: player battles, gunnery tooling, weather phases, tactical classification, aircraft, carrier operations, missiles, orders, realism. The reachability ledger classifies every seam in the package `exports` table; retiring or renaming a seam moves its row in the same change.

3. **Exact-duplicate pure helpers centralise in `src/core/`.** A pure helper that is semantically identical in several seams moves to `src/core/` as one module. `compareStrings` lives in `src/core/ordering.ts`; seams that already exported it re-export from there. Seam-local copies remain only where the semantics differ (e.g. `damageMultiplierBp` in mines vs. air defence). Tiny helpers such as `clamp` and `clampBp` stay local: their bounds, argument order or NaN behaviour differ.

4. **Spec-only modules are deleted.** The eight modules that existed only to satisfy their own tests (`tacticalPipeline`, `commandReach`, `commandQuantization`, `commandRecord`, `realism`, `fullSpeedStress`, `battleTurnAway`, `withdrawal`), their shared reason codes, the `BattleGenerator` pass-through class, and the resolver's duplicate `BattleManifest` interface are removed.

5. **Tests cross the interface.** Combat tests import `@bluewave/combat` or a subpath seam, never `../../src`. The package Vitest config aliases both to `src` so a test run does not depend on a prior build.

6. **Compiled design capabilities reach combat.** `CompiledDesignVersion.capabilities` is an optional `readonly DesignCapability[]`. The ship-design compile stage collects every resolved part's capabilities and sorts them by `kind`, then by canonical serialization. Duplicates are retained for consumers to decide whether to sum or take the best. The design hash covers the list. Combat projects capabilities onto `TacticalShipUnit.capabilities`; `buildDamageControlContexts` sums the `damage_control` effects. The save snapshot decodes `designs` with a strict `StorableCompiledDesignVersionSchema` that enforces a closed discriminated union, non-decreasing `kind` order and strict excess-key rejection.

7. **Combat modules extend through the capability seam.** A module (e.g. `missiles`) owns its contract, launcher and in-flight state, projection, records, ordering, reason codes and resolution. Eligibility is the carried capability, not a hidden rule. The ruleset block is optional and threaded through `MonthExecutorEngineOptions`; a caller without it gets today's behaviour. Damage reuses the existing `resolveDamage` model. No duplicate authority surface is introduced.

8. **Division orders are a versioned, runtime-free contract.** `@bluewave/combat/orders` owns `DivisionOrderSet` and `DivisionOrder` with `navigation` (stance, course or waypoint), `speed` (percent, knots or one of five presets), `formation`, `role`, `leadDivisionId`, `control` and `turnTogether`. `compileDivisionOrders` is the single pure compiler; the existing stance wire shape converts losslessly through `divisionOrdersFromLegacy`. Stance is a preset, not a second engine path. Orders take effect at the next minute boundary.

9. **Realism modes gate orders in the engine.** `@bluewave/combat/orders` exports `RealismMode` (`ADMIRAL`, `REAR_ADMIRAL`, `CAPTAIN`) and `realismPermissions` for the whole matrix. The UI must call the same function to grey out controls. A forbidden order is refused with `ORDER_NOT_PERMITTED_AT_REALISM` and never silently downgraded. `assertOrderPermitted` carries the mode, capability, lead-division flag, sight flag and target kind in the error context. The mode is snapshotted from the player preference at battle start, fixed for the battle and included in the battle input hash. Computer-controlled forces are unaffected.

## Consequences

- A new internal module needs no ledger row until exported as a seam; a new seam fails the ledger gate until classified. Consumers name the capability they use, so the dependency direction is visible in each import.
- One definition of codepoint ordering; no hash or ordering change.
- Later capability consumers inherit one seam instead of adding a second design record.
- A save containing a capability list written by a reader without this field is refused by strict design decode or the snapshot hash gate, never silently loaded.
- A campaign battle can observe missile launch, intercept and hit through the auto resolver and the player battle loop when its designs carry a launcher.
- Stance-only battles compile through one model; T-2 slices for formation keeping, realism, force orders and the battle map have a stable, versioned input and do not need a second order path.
- The UI and the engine share one permission source, so a control cannot be enabled for a mode that would reject it.
- No gameplay, ordering or hash changes from structural decisions: the verbs are the same functions and the retired modules were unreachable from production code.