# Tactical battle navigation: spec (map #324)

What the T-2N slices shipped in `@bluewave/combat`, where the seams are, and what stays open. Verified against `dev` on
2026-11-19. Reference: Rule the Waves 3 manual pp. 78-88 and 98-101. Role decisions: #332 resolution and Discussion #939.

## Contract

- **Dormant.** No production battle resolution supplies `navigation`, `collision`, `terrain`, force orders or division AI,
  so every optional input changes no hash when absent and no golden, replay or compatibility version moved. The
  reachability rows `combat-navigation` and `combat-terrain` in `scripts/data/reachability-ledger.json` records it.
- **One order path.** Player, force and AI orders are `DivisionOrder`s compiled by `compileDivisionOrders` to per-ship
  `UnitOrders`. The engine has no second input.
- **Pure seams.** Each module is a pure function of explicit inputs; state returns to the caller (`MachineryState`,
  `SeparationState`, `CollisionState`, `ForceState`, `DivisionAiMemory`), none lives in a module.
- **Random draws** use the seeded ledger with a named stream: `NAVIGATION_BREAKDOWN_STREAM`, `NAVIGATION_SEPARATION_STREAM`.
- **Values** are PROVISIONAL ruleset or content data (`PROVISIONAL_COLLISION_RULES`, `PROVISIONAL_DIVISION_AI_RULES`, the
  `navigation` section), never code constants a player could see as fact.
- **Moving a golden** needs the [replay approvals](../../docs/agents/replay-corpus.md); #959 is that decision.

## Modules

| Seam                                           | Owns                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bluewave/combat/orders`                      | `DivisionOrderSet`, `compileDivisionOrders`, realism matrix, waypoint orders (`WAYPOINT_ARRIVAL_TOLERANCE_METRES`, event `WAYPOINT_REACHED_EVENT_TYPE`), force orders (`ForceOrderKind`, `createForceRuntime`, `advanceForce`, `ForceState`)                   |
| `@bluewave/combat/terrain`, #935               | `TerrainView`; queries `pointInLand`, `pointInNoGoZone`, `segmentCrossesLand`, `nearestCoastPoint`. Compiled to the sidecar `terrain-artifact.json` (`buildTerrainArtifact`, `@bluewave/content-compiler`), never into the bundle ([RULES.md](../../RULES.md)) |
| `@bluewave/combat/navigation`, #937, #941      | `resolveNavigation`, `applyNavigation`: fouling (`FoulingLevel` GRATES_FOULED then STOKERS_EXHAUSTED), breakdown, per-ship `vibrationBp`, speed-limit `explainAttainableMax`; `resolveSeparation` for heavy and non-line-ahead formations                      |
| `@bluewave/combat/collision`, #940             | `CollisionContext` (`terrain`, `shipCollision`, `state`), `createMovementHazards`, `steerClearOfLand`; records `COLLISION` and `TERRAIN_BLOCKED`, speed caps through `CollisionState`                                                                          |
| `@bluewave/combat/division-ai`, #943           | `decideDivisionOrders(view, memory)` returns orders, new `DivisionAiMemory` and reasons; role behaviours CORE, SUPPORT, SCOUT, SCREEN, PATROL, INDEPENDENT; `flotillaDelayMinutes`                                                                             |
| `@bluewave/combat/battleResolution`, #936-#954 | `battleView` (fog-aware `BattleView` DTO, strict decode, `BattleViewOwnShip.machinery` and `.separation`), `enablePlayerForceOrders`, `advancePlayerForce`, waypoint settling and pause kinds; the legacy `playerBattleView` is retired                        |

Wiring: `AdvanceMinuteInput` carries `navigation` and `collision`; `advanceMinute` runs `applyNavigation` first and the
engine feeds `machinery`, `separation` and collision `state` back each minute.

## Behaviour that shipped

- **Waypoint.** Arrival inside the tolerance records `waypoint_reached` and can pause the run; `WAYPOINT_MAX_METRES` bounds it.
- **Machinery.** Ruleset-driven grates fouled (-1 kn) and stokers exhausted (-2 kn) by class (`OIL`, `COAL`, `VTE`), breakdown
  chance by speed with a repair cap, and a vibration level at full speed. `vibrationBp` is reported; no gunnery stage consumes it yet.
- **Separation.** A seeded draw per non-line-ahead formation, raised at night and in poor visibility; drift, rejoin, and the
  `SEPARATED` or `DISORDERED` flag on `BattleViewOwnShip`.
- **Collision.** Ship hull contact applies a speed cap and impact damage; land and no-go zones block movement.
- **Force orders.** Flotilla attack or recall, rally, disengage, change lead division, battle turn away, behind the opt-in
  `enablePlayerForceOrders`.
- **AI roles.** Role-aware tiers: OPEN below 4000 bp force morale, WITHDRAW below 2000 bp (`openRangeBelowBp`,
  `withdrawBelowBp`); CORE does not withdraw while the lead is player-controlled. `decideDivisionOrders` orders only `control: AI` divisions other than the lead division.

## Decisions

- Production wiring is **#959**: it supplies `collision` (terrain, hull length and beam) to battle resolution, moves goldens, and
  needs replay-corpus approvals and a deliberate go. Until then nothing above is reachable from a player battle.
- AI memory is an explicit input and output of `decideDivisionOrders`; saving it in battle state is **#961**.
- Grates and stokers belong to this work, not SPRINT-PLAN T-3.

## Open follow-ups

| Issue | Work                                                                     |
| ----- | ------------------------------------------------------------------------ |
| #957  | Read-model flag when a planned route crosses land (`segmentCrossesLand`) |
| #958  | Steer AI and compiled orders clear of known minefields                   |
| #959  | Wire `collision` and `terrain` into production battle resolution         |
| #961  | Persist the division AI memory in saved battle state                     |

Also open and unticketed: gunnery use of `vibrationBp` and the battle-map screen.

## Out of scope

Strategic one-hop movement (F-1), air and carrier operations, submarine navigation, the battle map screen.
