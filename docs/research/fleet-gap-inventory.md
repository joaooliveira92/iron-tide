# Fleet gap inventory: what packages/campaign already implements

Research for #194 (parent map #193). Findings only: no design decisions, no code changes.
Method: local code reading at commit `ddd137d` (dev). Status key: **present** (behaviour exists and is wired),
**partial** (some of the section exists), **missing** (no code found; searched `packages/*/src`, `apps/desktop/src`).
The 26-section design text is not in the repo; section groups below follow the headings listed in #194.

## Module inventory (what exists)

| Module | Symbols | What it does |
|---|---|---|
| `packages/campaign/src/readiness.ts` | `SHIP_READINESS_STATES` (ACTIVE, RESERVE, MOTHBALLED, WORKING_UP, REPAIR), `crewCeilingFor`, `rampCrewQuality`, `readinessAfterCrewRamp`, `resolveShipReadinessSeed`, `battleReadiness` | Per-ship readiness vocabulary, crew quality 0..100, ceilings per state, +/-5 per month ramp, WORKING_UP to ACTIVE at crew >= 60 |
| `packages/campaign/src/maintenance.ts` | `shipMaintenanceCost`, `shipMonthlyMaintenanceCost`, `nationMonthlyMaintenance`, `nationIsAtWar`, `MAINTENANCE_*_MULTIPLIER_BP` | One shared integer per-ship formula (`floor(hp*10/100)` scaled by state bp; wartime x1.25 on ACTIVE only) |
| `packages/campaign/src/division.ts` | `PermanentDivision`, `applyDivisionCommand`, `applyCommanderChange`, `assertDivisionInvariants`, `DIVISION_PENALTIES`, `DIVISION_ROLES`, `DIVISION_FORMATIONS`, `divisionAggregateHash` | Permanent division aggregate (DESIGN-26): ships (max 5, DD max 6), flagship = first, commander, role, preferred formation, experience, cohesion, co-location, type compatibility, reorganisation penalties |
| `packages/campaign/src/divisions.ts` | `buildSeededDivisions`, `DivisionSeedFailure`, `DIVISION_SEED_CODES` | Compile-time seeding of 1880 divisions from authored content (initial experience 20, cohesion 30) |
| `packages/campaign/src/officers.ts` | `Officer`, `buildOfficerRoster`, `officerAccuracyBp`, `VACANT_COMMANDER_ACCURACY_BP`, `ROSTER_SHAPE` | Deterministic fictional roster per nation; ranks CAPTAIN/COMMODORE/REAR_ADMIRAL; one `skill` 30..90 |
| `packages/campaign/src/movement.ts` | `fleetMoveProblem` | One sea-route hop per month between directly connected areas (ADR-0062); validator shared by command validation and month apply |
| `packages/campaign/src/presence.ts` | `presenceAreaIds` | Distinct areas of a nation's owned possessions (ADR-0231) |
| `packages/campaign/src/state.ts` | `Ship` (readiness, crewQuality, repairMonthsRemaining, availability), `FleetState`, `AreaData`, `RouteData`, `NationDockState`, `PossessionData`, `BlockadeState` | Snapshot types |
| `stationAssignment` | none | **Does not exist.** No file or symbol of that name anywhere in the repo (excluding vendor/node_modules). S-5 foreign-station assignment is specified (map #54) but not implemented |

Wiring outside `packages/campaign`: monthly readiness step `packages/phase-engine/src/readinessEvolution.ts`
(`applyReadinessEvolution`, called from `economyPhases.ts` ~L610 after maintenance is charged; emits `ShipReadinessChanged`,
`events.ts` ~L192); battle gating reads `crewQuality` (`phase-engine/src/battles.ts` ~L43-51, `battlePhases.ts` ~L41);
division commands `phase-engine/src/divisionCommands.ts`, `commands/src/divisionValidation.ts`; fleet presentation
`campaign-engine/src/fleet.ts` (`READINESS_STATUS_LABEL`), `projection.ts`, `opening-briefing.ts`; division tactical use
`combat/src/tactical/division.ts` (role/formation eligibility).

## Gap table by in-scope design section group

| Section group | Status | Evidence (files and symbols) | Notes on what is absent |
|---|---|---|---|
| Ship lifecycle and readiness, §5-6 | **present** for the five-state model; **partial** for lifecycle | `readiness.ts` states, ceilings, ramp; `readinessEvolution.ts` REPAIR countdown (L48-54), release to ACTIVE (L21); `Ship.repairMonthsRemaining`; `constructionPhase.ts` L300 new hull enters WORKING_UP; ADR-0223; `docs/research/s-1-readiness-and-maintenance.md` | Under-construction and availability (`DEGRADED`/`UNAVAILABLE`, ADR-0078) are separate fields, not readiness states. No command to set a ship's readiness was found in `packages/commands` or `phase-engine/src/commands.ts` (the `Ship.readiness` comment says "player-settable" but no setter was located). No obsolescence/age/retirement/scrapping lifecycle found in `packages/campaign`. Crew ceilings and ramp are `balance_adjustment` values (ADR-0223, decision request 0007) |
| Regions, movement, base capacity, §7 | **partial** | `movement.ts` `fleetMoveProblem` (one hop per month, sea routes, land excluded, `UNAVAILABLE` ship blocks fleet); `state.ts` `AreaData` (id, name, type, controller), `RouteData` (has `distance`, unused by the hop rule), `FleetState.locationAreaId`; `presence.ts`; ADR-0231 (`NationState.homeAreaId`, `WorldState.possessions`) | No regional-command grouping above `AreaData`. No base/port capacity in `packages/campaign` (`NationDockState` and `PossessionDockExpansionEligibility` are construction/repair mass ceilings, DESIGN-16, not berthing capacity). No supply/fuel range, speed-based or multi-hop movement, strait gating (Suez/Panama listed under F-1 in SPRINT-PLAN) |
| Permanent divisions, roles, cohesion, §8-11 | **present** (aggregate and commands); **partial** (cohesion dynamics) | `division.ts` aggregate, `DIVISION_ROLES` (INDEPENDENT, CORE, SUPPORT, SCOUT, SCREEN, PATROL; list in `content-schema/src/campaign.ts` L128), `DIVISION_FORMATIONS`, size bounds 5 / 6 (DD), `DIVISION_PENALTIES`, reason codes; `divisions.ts` seeding; `phase-engine/src/divisionCommands.ts` create/add/remove/flagship/reorder/dissolve; `combat/src/tactical/division.ts` role eligibility | Cohesion and experience change only through reorganisation penalties (`applyDivisionCommand`); `grep cohesion` in `phase-engine` finds only the initial seed (`divisionCommands.ts` L105) and clone fields. No monthly cohesion/experience growth and no cohesion effect on movement or missions in campaign (any battle use is in `combat`). `DIVISION_TYPES` lists TACTICAL_DIVISION but only permanent divisions are modelled in campaign state. `CHANGE_ROLE`/`CHANGE_FORMATION` exist as `DivisionReorgReason` values with no handler in `applyDivisionCommand`. No division-level movement command or readiness aggregation |
| Officers, §12 | **partial** | `officers.ts` roster, rank, single `skill`, `officerAccuracyBp` (20 bp per skill point around 50), `VACANT_COMMANDER_ACCURACY_BP` 9000; `division.ts` `applyCommanderChange` (free to fill a vacancy; -5 experience / -10 cohesion to replace); ADR-0065, ADR-0224 | Roster is static after compile: no ageing, promotion, death/retirement, ability reveal, traits, succession or academy (SPRINT-PLAN row "Officers ... Partial"). Officers affect only division accuracy. A seed check allows one division per officer; no unassigned-pool logic found. T-1 map #96 lists officers (W-6) as out of scope |
| Missions, §13 | **missing** at campaign level | No mission type in `packages/campaign`; `combat` has battle "mission" classes used by battle generation (T-1 map #96 ticket H: fleet and cruiser battles offered; coastal raid and convoy registered-unreachable) | No fleet or division mission/standing-order state, no patrol, escort, blockade-run or raid assignments in the snapshot |
| ASW and escort, §14 | **missing** | SPRINT-PLAN capability table: "Submarine policy, ASW, operational mining ... Missing at campaign level"; W-1 (trade protection, raiders) and W-2 (ASW rating) are future sprints | No escort/convoy/ASW state in `packages/campaign` |
| Maintenance and budget, §15-16 | **present** (maintenance by state); **partial** (budget) | `maintenance.ts`; `phase-engine` maintenance phase and `nationMonthlyMaintenance` shared with `campaign-engine/projection.ts` and `opening-briefing.ts`; wartime x1.25; ADR-0223; `economyOutlook.ts`, `economy.ts` | Mothballed x0.5 and repair x2 are manual-grounded (pp.30, 51); reserve 0.75, working-up 1.0, wartime 1.25 are `balance_adjustment`. Base rate is hit-point based (not displacement, age or class). No refit/modernisation upkeep adders, no per-region or per-division budget, no standing reserve/maintenance policies. Wider budget model belongs to Economy map #123 (ADR-0230) |
| Training, §16 | **partial** (crew only); **missing** (programs) | Crew quality ramp in `readiness.ts`; `docs/research/s-1-readiness-and-maintenance.md` "Special training (pp.53)" lists maintenance adders as deferred | No special training or fleet exercise (SPRINT-PLAN: "Special training, fleet exercise (pp.52-53) Missing"). Division experience has no growth source |

## Foreign station / presence (adjacent to §7)

| Item | Status | Evidence |
|---|---|---|
| Presence areas | present | `presence.ts` `presenceAreaIds`; ADR-0231 |
| Home area as authoritative content | present | `NationState.homeAreaId`; compiler codes `HOME_AREA_MISSING`/`HOME_AREA_UNKNOWN` |
| Foreign-station assignment, tonnage obligation, penalties, base limits | missing | No `stationAssignment` module; map #54 decisions A-J locked, values gated behind grounding ticket #72 |

## Overlap with neighbour maps (their locked decisions win by default)

Bodies and closed-ticket decision lines of #54, #96, #123 were read via `gh issue view`.

| Map | Overlapping fleet-v2 topic | Locked decision (ticket) | Implication for #193 inventory |
|---|---|---|---|
| #54 S-5 | Station as an assignment | FS is a station assignment orthogonal to readiness; FS ships are ACTIVE; no new maintenance rate (#58) | Readiness states must not gain an FS state; overlaps §5-7 |
| #54 | Relocation | FS ships route one hop per month to the largest-shortfall presence area, ties by area id, single-ship detach (#69) | Overlaps §7 movement and fleet detach; `fleetMoveProblem` is the existing hop rule |
| #54 | Presence counting, areas, base limits | Active or FS ships count, colonial service x1.5 (fraction gated) (#61); presence areas = areas of owned possessions, home area authoritative (#68, ADR-0231); end-of-month ship-count check vs base-derived limit with `*` flag, values gated (#67); blockade exemption (#64) | Base capacity in §7 overlaps #67; values gated by #72 |
| #54 | Penalty interface | Typed shortfall event and penalty requests to S-2/S-3 (#66) | Fleet penalties would use this interface |
| #54 | Rollout and UI | Optional ruleset section, dormant when absent (#71); fleet screen shows FS and `*` (#70) | Fleet UI work overlaps #70 |
| #96 T-1 | Mission types | Offer fleet and cruiser battles; coastal raid and convoy stay registered-unreachable (W-1 / unowned) (#104) | Convoy/raid missions in §13 belong to W-1 |
| #96 | Readiness gating | Depends on S-1 gating (complete); offers only with eligible force (#97) | Battle eligibility already reads readiness/crew |
| #96 | Divisions, officers | Destination cites manual pp.54-55 divisions; battle generation internals out of scope; officers (W-6) out of scope | Division use in battle is T-1/T-2; officer work is W-6 |
| #123 Economy | Maintenance and budget | Ledger `closing = opening + revenue - construction - preservation - maintenance - obligation - research` with requested/paid/shortfall (G2 #129, G5 #132); integer monthly TU | §15-16 must post through this ledger; shortfall policy fixed (G5) |
| #123 | Projection | One `projectMonthlyLedger` feeds projection, briefing, priorities (G6 #134) | A fleet budget planner would consume it |
| #123 | Construction capacity | Capacity = yard throughput plus tonnage concurrency cap of 3 x national dock; never from `baseResources` (G3 #130) | "Base capacity" in §7 is a different concept; do not conflate |
| #123 | Growth, volatility, colony income | Documented extension points (G7 #135) | Colonial base/income hooks overlap §7 |

Related ADRs: 0062 (movement, cited in `movement.ts`), 0065 (officers), 0078 (ship availability), 0213 (`balance_adjustment`),
0223 (S-1 constants), 0224 (1880 divisions and officers), 0230 (economy model), 0231 (home area and possessions).

## Observations (not decisions)

- `.ai/SPRINT-PLAN.md` capability table still says "Ship readiness ... Missing"; the code shows S-1 delivered, so that row is stale.
- Crew ceilings, reserve/working-up/wartime maintenance multipliers, division penalties and officer scale are unsourced balance values, so any v2 numbers in the design input need provenance under ADR-0213.
- Not located: a player command that sets a ship's readiness (verify before relying on it).
