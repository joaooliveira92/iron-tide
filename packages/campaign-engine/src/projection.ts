import type { CampaignState } from "@bluewave/campaign";
import {
  economyOutlook,
  type EconomyStatus,
  type ResearchUnfundedReason,
} from "@bluewave/campaign";
import { totalPaidWork } from "./opening-briefing.js";

export type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign";

const KILOGRAMS_PER_TON = 1_000;

/**
 * One nation's slice of `CampaignSnapshot`, flattened for UI convenience.
 * Shape confirmed in the desktop-mvp map, ticket 07 (Q15), with fields
 * grounded in `overview-screen-state.test.ts` and `OverviewScreen.tsx`.
 */
export interface PlayerProjectionEconomy {
  readonly treasury: number;
  /** The monthly gross naval appropriation credited to the treasury: `floor(base x rate / 120000)`. */
  readonly monthlyAppropriation: number;
  readonly shipyardCapacity: number;
  /**
   * The nation's total committed work across its construction projects — the
   * cumulative `sum(Number(project.paidWork))`. A stock, not a monthly flow: it
   * feeds no net figure (the monthly bound is `plannedConstruction`).
   */
  readonly constructionSpend: number;
  /**
   * The research the engine will actually draw next month: the standing budget when a field can take it, else 0 (see
   * `researchUnfundedReason`).
   */
  readonly researchSpend: number;
  /**
   * The nation's fleet maintenance next month, war-aware — the maintenance phase's own calculator over its ships, never the
   * raw `nation.maintenanceCost` (0 before the first `commitMonth`).
   */
  readonly maintenanceCost: number;
  /** Fixed monthly obligations (`NationState.expenses`). */
  readonly obligations: number;
  /** The standing monthly research budget as set, whether or not the engine will pay it. */
  readonly researchRequested: number;
  /** The most research the nation may fund: `floor(12% x monthly revenue)`. */
  readonly researchCap: number;
  /** Why a standing research budget is not paid next month; absent when it is, or when none is set. */
  readonly researchUnfundedReason?: ResearchUnfundedReason;
  /** An upper bound on next month's construction work: what the yards can absorb, before the treasury limits it. */
  readonly plannedConstruction: number;
  /** Revenue less obligations, maintenance and planned research: the net before construction. */
  readonly projectedNet: number;
  /** Unpaid obligations, maintenance and research if next month ran with construction at its upper bound. */
  readonly shortfall: number;
  /** The band of `projectedNet` against the monthly revenue; the one status every surface shows. */
  readonly status: EconomyStatus;
  /** The treasury after next month at that upper bound (never negative: a shortfall is not carried). */
  readonly monthEndTreasury: number;
  /** Whole months the treasury lasts at a negative net; absent when the net is not negative. */
  readonly runwayMonths?: number;
}

export interface PlayerProjectionPort {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly capacity: number;
}

export interface PlayerProjectionShip {
  readonly name: string;
  readonly designId: string;
  /** Readiness state (S-1 ticket 07): active/reserve/mothballed/working_up/repair. */
  readonly readiness: string;
  /** Worked-up crew quality `0..100` (S-1 ticket 07). */
  readonly crewQuality: number;
  /** The authoritative station assignment (S-5 03); absent when the ship has none. */
  readonly stationAssignment?: "FOREIGN_STATION";
  /**
   * The ship's displacement in metric tons, from its compiled design's `normalizedDisplacementKg`
   * (rounded). Absent when the design is not in the snapshot: an unknown tonnage is never zero.
   */
  readonly displacementTons?: number;
}

export interface PlayerProjectionDivision {
  readonly name: string;
  readonly areaId: string;
  readonly ships: readonly PlayerProjectionShip[];
}

export interface PlayerProjectionFleet {
  readonly name: string;
  readonly divisions: readonly PlayerProjectionDivision[];
}

export interface PlayerProjectionStrategicArea {
  readonly id: string;
  readonly name: string;
}

export interface PlayerProjectionMonth {
  readonly month: number;
  readonly year: number;
}

export interface PlayerProjectionCommandWorkspace {
  readonly commands: readonly unknown[];
  readonly movementCommands: readonly unknown[];
}

export interface PlayerProjection {
  readonly campaignIdentity: string;
  readonly snapshotHash: string;
  readonly revision: number;
  readonly month: PlayerProjectionMonth;
  /**
   * The nation id of the player slot this projection was built for. Derived,
   * read-only projection data (never authoritative state and never persisted):
   * it lets presentation tell the player's side from the AI's without guessing
   * from ordering or nation identity.
   */
  readonly playerNationId: string;
  readonly nationName: string;
  /**
   * Projected monthly surplus/deficit for the nation: the net before construction, from the same calculators the month
   * executor uses (`economyOutlook`) — revenue less obligations, war-aware maintenance and the research the engine will
   * pay. Purely derived over the immutable snapshot.
   */
  readonly projectedSurplusDeficit: number;
  readonly economy: PlayerProjectionEconomy;
  readonly fleet: readonly PlayerProjectionFleet[];
  readonly ports: readonly PlayerProjectionPort[];
  readonly knownTechnologyIds: readonly string[];
  readonly strategicAreas: readonly PlayerProjectionStrategicArea[];
  readonly knownEnemyNations: readonly string[];
  readonly commandWorkspace: PlayerProjectionCommandWorkspace;
}

/**
 * Builds a `PlayerProjection` for `playerSlotId` from a real compiled
 * `CampaignState` — the function ticket 12 found missing (only the type
 * existed). Every field is derived from real snapshot data, not
 * placeholders:
 *
 * - every `economy` flow comes from `@bluewave/campaign`'s `economyOutlook`, the
 *   calculators the month executor itself uses (spec #138), so the screen
 *   cannot contradict the ledger the month then produces.
 * - `economy.shipyardCapacity` and each port's `capacity` are the nation's
 *   own ports' authored `level` — there is no dedicated "shipyard capacity"
 *   concept elsewhere in the engine yet, so port level is the closest real,
 *   non-fabricated proxy (documented judgment call, ticket 12).
 * - `economy.constructionSpend` is the cumulative committed construction work
 *   (`sum(paidWork)`, a stock); the monthly bound is `economy.plannedConstruction`.
 * - `nationName` is `NationState.name`; `projectedSurplusDeficit` is the outlook's
 *   projected net before construction.
 * - `fleet` flattens each compiled `FleetState` into one division carrying
 *   all of its ships — the compiled snapshot has no separate division
 *   grouping under a fleet (see `commandWorkspace`, deliberately left empty:
 *   real command listings are tickets 09/10's concern, not this one).
 * - `strategicAreas` are the world areas this nation controls.
 * - `knownTechnologyIds` is the nation's `research.discoveredTechs`.
 * - `knownEnemyNations` are derived from `politics.relations` where the
 *   relation is `at_war` and this nation is a party.
 *
 * Returns `undefined` if `playerSlotId` doesn't resolve to a nation in the
 * snapshot.
 */
export function buildPlayerProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
): PlayerProjection | undefined {
  const snapshot = state.snapshot;
  const nation = snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  const ports: PlayerProjectionPort[] = snapshot.world.ports
    .filter((port) => port.nationId === playerSlotId)
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      capacity: Number(port.level),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const shipyardCapacity = ports.reduce((sum, port) => sum + port.capacity, 0);
  const outlook = economyOutlook(snapshot, playerSlotId)!;
  // Construction committed so far: a stock shown for context, never a monthly flow.
  const constructionSpend = totalPaidWork(nation);

  const fleet: PlayerProjectionFleet[] = nation.fleets.map((f) => ({
    name: f.name,
    divisions: [
      {
        name: f.name,
        areaId: f.locationAreaId,
        ships: f.ships.map((ship) => {
          const design = snapshot.designs.get(ship.designVersionId);
          return {
            name: ship.name,
            designId: ship.designVersionId,
            readiness: ship.readiness,
            crewQuality: Number(ship.crewQuality),
            ...(ship.stationAssignment === undefined
              ? {}
              : { stationAssignment: ship.stationAssignment }),
            ...(design === undefined
              ? {}
              : {
                  displacementTons: Math.round(
                    Number(design.normalizedDisplacementKg) / KILOGRAMS_PER_TON,
                  ),
                }),
          };
        }),
      },
    ],
  }));

  const strategicAreas: PlayerProjectionStrategicArea[] = snapshot.world.areas
    .filter((area) => area.controller === playerSlotId)
    .map((area) => ({ id: area.id, name: area.name }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const knownEnemyNations = [
    ...new Set(
      snapshot.politics.relations
        .filter(
          (relation) =>
            relation.relation === "at_war" &&
            (relation.nationA === playerSlotId || relation.nationB === playerSlotId),
        )
        .map((relation) =>
          relation.nationA === playerSlotId ? relation.nationB : relation.nationA,
        ),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    campaignIdentity: snapshot.campaignId,
    snapshotHash: state.rawHash,
    revision: Number(snapshot.turnNumber),
    month,
    playerNationId: playerSlotId,
    nationName: nation.name,
    projectedSurplusDeficit: outlook.projectedNet,
    economy: {
      treasury: Number(nation.treasury),
      monthlyAppropriation: outlook.revenue,
      shipyardCapacity,
      constructionSpend,
      researchSpend: outlook.plannedResearch,
      maintenanceCost: outlook.maintenance,
      obligations: outlook.obligations,
      researchRequested: outlook.researchRequested,
      researchCap: outlook.researchCap,
      ...(outlook.researchUnfundedReason === undefined
        ? {}
        : { researchUnfundedReason: outlook.researchUnfundedReason }),
      plannedConstruction: outlook.plannedConstruction,
      projectedNet: outlook.projectedNet,
      shortfall: outlook.shortfall,
      status: outlook.status,
      monthEndTreasury: outlook.monthEndTreasury,
      ...(outlook.runwayMonths === undefined ? {} : { runwayMonths: outlook.runwayMonths }),
    },
    fleet,
    ports,
    knownTechnologyIds: [...nation.research.discoveredTechs].sort((a, b) => a.localeCompare(b)),
    strategicAreas,
    knownEnemyNations,
    commandWorkspace: { commands: [], movementCommands: [] },
  };
}
