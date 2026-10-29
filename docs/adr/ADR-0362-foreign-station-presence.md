# ADR-0362: Foreign station presence — measurement, assignment, base limits, and penalties

Consolidates: ADR-0231, ADR-0241, ADR-0242, ADR-0247, ADR-0248, ADR-0249, ADR-0250, ADR-0251, ADR-0266

Applies to: campaign, campaign-engine, commands, content, content-compiler, content-schema, desktop, events, phase-engine, ship-design

Rule: S-5 presence is measured at month end from authored ruleset values; nations own possessions in presence areas, deploy ships on foreign station duty, and incur penalties for shortfalls, with exemption for blockade, while base limits constrain over-deployment.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0231
Supersedes: ADR-0241
Supersedes: ADR-0242
Supersedes: ADR-0247
Supersedes: ADR-0248
Supersedes: ADR-0249
Supersedes: ADR-0250
Supersedes: ADR-0251
Supersedes: ADR-0266

## Context

S-5 (foreign stations and presence, manual pp.45-48) needs each nation's home area, possession ownership, a way to mark ships as being on foreign station, a colonial-service fitting flag, a presence measurement system, blockade exemption, automated deployment routing, base-limit checks, and a fleet-screen readout. No numeric values were initially sourced (research note `docs/research/s-5-presence-and-base-limits.md`). The owner resolved every open decision request by delegation (0266), admitting unsourced values as labelled `balance_adjustment` targets (`BALANCE_TARGET`), with the "simulation matches RTW3" constraint waived for these values only.

The month-end presence sequence runs as four distinct phases in order: `battle_resolution`, `presence_measurement`, `foreign_station_deployment`, `base_limits` (ADR-0272).

## Rules

### 1. Nation home area and possession ownership

1.1. `homeArea` is an optional `Nation` field in `countries.yaml`. The compiler validates it against the area set: a nation without one fails with `HOME_AREA_MISSING`, one naming an unknown area with `HOME_AREA_UNKNOWN`. The check does not depend on the area set being non-empty. Values are the existing presentation-join values (a parity test pins this); the presentation join stays presentation.

1.2. `NationState.homeAreaId` and `WorldState.possessions` (`id`, `nationId`, `areaId`, ordered by id) are additive, optional snapshot fields.

1.3. A nation's presence areas are derived, never stored: the distinct areas of the possessions it currently owns, ordered by area id (`presenceAreaIds`). Updating a possession's `nationId` changes the answer on the next evaluation.

1.4. `WorldMapView` nations expose `homeAreaId` and `presenceAreaIds`.

### 2. Foreign-station assignment

2.1. `Ship.stationAssignment?: "FOREIGN_STATION"` is an optional field, orthogonal to `readiness`. A ship holding it is `ACTIVE`; maintenance, crew and battle eligibility read `readiness` only.

2.2. `AssignForeignStation` and `ClearForeignStation` take `{ nationId, shipIds }`. The whole command is rejected when any ship is ineligible. `stationAssignmentProblems` (`@bluewave/campaign`) returns one typed reason per ship, ordered by ship id: `NOT_OWNED`, `UNDER_CONSTRUCTION`, `NOT_OPERATIONAL`, `NOT_ACTIVE`, `ALREADY_ASSIGNED`, `NOT_ASSIGNED`, plus `EMPTY_BATCH` and `DUPLICATE_SHIP`. The rejection diagnostic is `STATION_ASSIGNMENT_REJECTED` and names every `shipId=REASON`. Commands are validated against the month-start snapshot and re-checked at apply time.

2.3. `setShipReadiness` is the single seam for readiness changes: any state other than `ACTIVE` clears the assignment. `transitionShipReadiness` (phase-engine) records `ShipReadinessChanged` and, when it removed an assignment, one `ShipStationAssignmentChanged` with reason `READINESS_LEFT_ACTIVE`. Assign and clear record the same event with `ASSIGNED` / `CLEARED_BY_COMMAND`.

2.4. The fleet projection adds `stationAssignment` and `stationCode: "FS"` (manual p.48), present only on assigned ships.

### 3. Colonial-service fitting

3.1. `DesignDraft.colonialServiceFitted?: boolean` (`true` = fitted; absent or `false` = unfitted). The `set_colonial_service` edit removes the key when unfitting, so an unfitted draft is byte-identical to one that predates the field. The same optional field is carried by the content-schema draft and the parts header, and validated by `validateDraftShape`.

3.2. The S-5 values live in one optional ruleset section, `presence`, on a ruleset in `rulesets.yaml`, decoded strictly by `decodePresenceRules` (`@bluewave/content-schema`). This ticket declares it with `colonialServiceDisplacementBp` (integer, 1..9999, basis points of target displacement) and a `provenance` block. Compile rejects a partial, mistyped, excess-key or out-of-range section with `PRESENCE_RULES_INVALID` naming the field, and two rulesets carrying a section with `PRESENCE_RULES_AMBIGUOUS`. Absent = dormant; no numeric default exists anywhere.

3.3. The value reaches the compile through `ShipBuildingData.presence`, filled from the compiled bundle's rulesets (`presenceFromRulesets`), and `ShipContext.colonialFitting`.

3.4. Compile effect: a fitted design takes `ceil(targetDisplacementKg * bp / 10000)` kg, integer arithmetic, into the `auxiliary` ledger line. The base is the draft's target displacement, not the solved total, so the fitting never feeds back into its own size. With the section dormant the fitting is recorded with `displacementKg: 0`, the compiled `colonialService` result says `configured: false`, and the advisory `COLONIAL_SERVICE_NOT_CONFIGURED` is raised. `CompiledDesign.colonialService` is present only on a fitted design.

3.5. `CompiledDesignVersion.colonialServiceFitted?: true` and `Ship.colonialServiceFitted?: true` record it. A launched hull copies it from its design; a finished rebuild takes the new design's value (dropping the old one). The fleet screen adds `colonialServiceFitted` and `colonialCode: "c"`; the player projection adds `colonialServiceFitted`.

### 4. Presence measurement and shortfall

4.1. `measurePresence` (`@bluewave/campaign`) is pure and integer-only. Per nation (id order) and presence area (id order) it returns `{ requiredTons, presentTons, shortfallTons }`; `shortfallTons = max(0, required - present)`.

4.2. Counting: a ship counts only when commissioned, operational, `ACTIVE` and located in the area; reserve, mothballed, working-up and repair contribute zero. A ship whose design is not in the snapshot counts nothing. Counted kilograms are `floor(displacementKg x w x f)` with `w` = 3/2 for a colonial-service ship on `FOREIGN_STATION` (else 1) and `f` = `crampedOrShortRangeCountBp / 10000` when its design is flagged cramped or short-range (else 1). Present tons are the area's summed kilograms floored to tons.

4.3. Cramped and short-range apply the one fraction once when either holds. The flags are optional `CompiledDesignVersion.crampedAccommodation` / `shortRange`. Classification: cramped = accommodation `SPARTAN`; short-range = `rangeNmAtCruise` below 2500 nm. A compile step writes the flags on `CompiledDesignVersion`.

4.4. Required tons = possessions in the area x `requiredTonsPerPossessionWeight` x `valueWeight`, where `valueWeight` = level of the nation's highest-level port in the area, else `noPortValueWeight`. The home area carries a requirement like any presence area.

4.5. The `presence` ruleset section gains the three required values `requiredTonsPerPossessionWeight`, `noPortValueWeight`, `crampedOrShortRangeCountBp`; the section stays all-or-nothing and strict (Rule 3.2).

4.6. The month-end step is the `presence_measurement` phase, running in `MonthExecutor` after `battle_resolution`, driven by `MonthExecutorEngineOptions.presence`. It records one `PresenceShortfall` event (`nationId`, `areaId`, `requiredTons`, `presentTons`, `shortfallTons` > 0) per shortfall in (nation, area) order, and changes no state.

4.7. `buildPlayerProjection(state, slot, month, presenceRules?)` adds `presence`: `{ configured: false }` when dormant, else `{ configured: true, areas: [{ areaId, requiredTons, presentTons, shortfallTons }] }` for the player's nation.

### 5. Blockade exemption and penalty requests

5.1. `isPresenceExempt(snapshot, nationId, month)` (`@bluewave/campaign`) is true when the nation belongs to a war whose status is not `ENDED` and is the `blockadedNationId` of a blockade record with `establishedMonth <= month`. The exemption covers every area. The month-end step skips an exempt nation entirely: no `PresenceShortfall`, no penalty request.

5.2. The player projection `presence` gains `exempt: boolean` (the exemption notice); an exempt nation's rows keep required and present but show shortfall 0.

5.3. Base-limit checks must not call `isPresenceExempt` (contract note on the function).

5.4. Penalty parameters are the optional ruleset field `penaltyRequests: true` (strict literal, absent = none). With it, each non-exempt shortfall emits, right after its `PresenceShortfall`, one `PrestigeLossRequested` and one `RevoltPressureRequested`, each `{ nationId, areaId, shortfallTons }` (integer tons, strict schema). Exactly one of each per nation-area-month, in (nation, area) order. S-5 mutates no prestige, unrest or treasury state; the requests are events only.

### 6. Foreign-station deployment routing

6.1. The month-end presence step returns non-exempt shortfall rows; `runForeignStationDeploymentStep` consumes them right after, so deployment shares the shortfall computation, the exemption and the dormant rule: with the `presence` section absent, or the nation exempt, there is no demand and nothing moves.

6.2. Per nation, the target is the shortfall row with the largest `shortfallTons`, ties by ascending area id. A ship with `stationAssignment = FOREIGN_STATION` and `ACTIVE` readiness that is not in any shortfall area of its nation moves one hop toward the target; ships are processed in ship-id order against the month's rows (not recomputed after each move).

6.3. Routing is a breadth-first hop count over `sea` routes between non-land areas; the next hop is the neighbour one hop closer, ties by ascending area id. No path leaves the ship and records `ForeignStationNoRoute`.

6.4. Only the assigned ship moves. In a multi-ship fleet it is detached into a new single-ship fleet `fleet-fs-<shipId>` (`ShipDetachedToFleet`); a ship already sailing alone keeps its fleet. If it is in a permanent division it leaves it first through the existing division `remove_ship` rule (flagship succession and its experience/cohesion penalty included) and `assertDivisionInvariants` is checked. A failed invariant leaves the ship unmoved with a `DIVISION_STATE_INVARIANT_FAILED` diagnostic.

6.5. `fleetMoveProblem` rejects a `MoveFleet` on a fleet holding an FS ship with `FOREIGN_STATION_ASSIGNED`. Clearing the assignment re-enables the order.

6.6. New typed events (`ShipDetachedToFleet`, `ShipRemovedFromDivision`, `ForeignStationShipMoved`, `ForeignStationNoRoute`) use strict schemas.

### 7. Base limits

7.1. The `presence` ruleset section gains an optional all-or-nothing `baseLimits` block: `limitByBaseLevel` (one integer per port level 1..`PORT_LEVEL_MAX`), `noBaseLimit`, `occupyingStates` (non-empty, unique S-1 states), `maintenanceAdderBp` and `crewQualityReduction` (0..100). No default exists. Absent block = base limits dormant even when the rest of the section is authored.

7.2. `measureBaseLimits` (`@bluewave/campaign`) is pure and integer-only. Per nation and area it counts commissioned, operational ships whose readiness is occupying; the limit is the table entry for the nation's best port level there, else `noBaseLimit`. Ships beyond the limit are the later ones in ascending ship id.

7.3. The month-end `runBaseLimitStep` runs as the `base_limits` phase last (after `battle_resolution`, `presence_measurement` and `foreign_station_deployment`). It reads no war or blockade and never calls `isPresenceExempt`. Flagged ships get `Ship.overBase = { maintenanceAdderBp }` and lose `crewQualityReduction` through the S-1 `reduceCrewQuality`; a ship no longer over loses the flag. It repeats every month while the ship stays over.

7.4. The maintenance consequence goes through the S-1 maintenance seam: `shipMonthlyMaintenanceCost` takes an optional adder (one extra floor rounding), and `nationMonthlyMaintenance` reads it from `Ship.overBase`. The flag carries the adder so no consumer needs the ruleset.

7.5. The player projection ship rows and the fleet screen carry `overBase` (and the manual's `*` code); absent otherwise. No new event kinds.

### 8. Fleet screen readout and assignment control

8.1. `buildFleetScreenView` (`@bluewave/campaign-engine`) gains additively: `shipId` and the p.48 `a` / `S` codes and repair month count on each ship row, `overBaseShips`, and `presence`. `presence` comes from the one `buildPresenceReadout` shared with the player projection. `L` is never inferred: only `S` is shown.

8.2. One new bridge command, `submitStationAssignment` (`intent` `assign` or `clear`, non-empty `shipIds`), queues the existing `AssignForeignStation` / `ClearForeignStation` envelope through `submitPlayerCommand`. The whole batch is rejected with `STATION_ASSIGNMENT_REJECTED` and per-ship reasons.

8.3. The renderer words those reasons from catalogue strings (`fleet.*` keys in `strings.ts`), shows every state as code plus text, uses native keyboard-operable controls and theme tokens only, and imports no `effect`.

8.4. The presence readout renders `required`, `present`, `shortfall`, the blockade exemption notice, the dormant 'not configured' text and the over-base list from the projection alone.

### 9. Values resolved by delegation

9.1. Every value below is a Bluewave balance decision (`kind: balance_adjustment`, `sourceStatus: BALANCE_TARGET`), recorded with rationale, authored as ruleset constants in the `presence` section by ticket #85. Nothing is presented as a sourced fact.

| Req | Item | Decision | Rationale |
| --- | --- | --- | --- |
| 0016 | Tonnage required | `requiredTonsPerPossessionWeight` 150; `noPortValueWeight` 2 | ~14,000 tons for UK's 15 possessions: a standing obligation a real 1880 fleet can meet. |
| 0017 | Base limit | `limitByBaseLevel` = 2 x level (2, 4, ... 20); `noBaseLimit` 2 | Linear so it is legible: a level-10 dockyard hosts 20 ships, two cruisers can coal anywhere. |
| 0018 | Slot-occupying states | `ACTIVE`, `RESERVE`, `WORKING_UP`, `REPAIR` (not `MOTHBALLED`) | Mothballed hulls sit in laid-up basins and draw no base services. |
| 0019 | Over-base effects | `maintenanceAdderBp` 2500; `crewQualityReduction` 2 points per month end; both certain | 25% extra upkeep is felt but not ruinous; 2 points on 0..100 scale erodes a fleet. |
| 0020 | Cramped/short-range fraction | `crampedOrShortRangeCountBp` 5000, applied once when either flag holds | Half credit, simplest "less than displacement". |
| 0021 | Colonial displacement | `colonialServiceDisplacementBp` 1500 | 15% of target displacement. |
| 0022 | Home area | Option A: the home area carries a requirement; the blockade exemption covers it | Literal reading of "each area where they have possessions". |
| 0023 | Penalties | `penaltyRequests: true`. Prestige loss 100 bp of current prestige per shortfall area per month; revolt pressure 1 unrest point per shortfall area per month, trigger = shortfall in same area for 3 consecutive months | Small and proportional (p.62), below 300 bp unpaid-funds loss. |
| 0026 | Classification | cramped = accommodation `SPARTAN`; short-range = `rangeNmAtCruise` below 2500 nm | Reuses existing design fields. |

9.2. Deferred: possession transfer (0027) remains unimplemented (#165 stays open). Support-force ordering (0035) keeps neutral placeholders (priority 0, fit 0, type `BB`; strongest ally first). Elevation cross-deck fire (0024) is out of scope for the 1880 start. `FC_INCOMPATIBLE` severity (0015) gets Option B: `ADVISORY` before a compatible director exists, `WARNING` afterwards.

### Compatibility

- Additive snapshot fields (Rule 1.2, 1.3) do not require a compatibility-version bump when older saves can be deterministically migrated or reconstructed without simulation ambiguity. `CURRENT_COMPATIBILITY_VERSION` stays `3.1.0` through all changes.
- The compiler never writes the new fields for existing content. Older saves load with them absent and the compiled state stays deterministic.
- The `presence` ruleset section is all-or-nothing and absent from the production pack until ticket #85. With the section dormant every measurement step returns `configured: false` and no behaviour changes.
- A save written after a base-limit flag was set carries `Ship.overBase`; older readers ignore it because the field is additive.

### Consequences

- Authoring the `presence` section (#85) is the one change that moves production behaviour and goldens; values are tested with fixture-class proportions only.
- Routing (S-5 07) and the fleet-screen controls (S-5 09) consume the assignment field and events without changing the model.
- Tuning every value is a ruleset version change with a re-pin, not a model or code change.
- If a higher-trust source for any value appears, it replaces the balance value through a ruleset version change.