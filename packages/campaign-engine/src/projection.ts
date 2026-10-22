import type { CampaignState } from "@bluewave/campaign";
import {
  economyOutlook,
  isPresenceExempt,
  measurePresence,
  monthId,
  type EconomyStatus,
  type PresenceMeasurementRules,
  type ResearchUnfundedReason,
} from "@bluewave/campaign";
import { totalPaidWork } from "./opening-briefing.js";

export type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign";

const KILOGRAMS_PER_TON = 1_000;

export interface PlayerProjectionEconomy {
  readonly treasury: number;
  readonly monthlyAppropriation: number;
  readonly shipyardCapacity: number;
  readonly constructionSpend: number;
  readonly researchSpend: number;
  readonly maintenanceCost: number;
  readonly obligations: number;
  readonly researchRequested: number;
  readonly researchCap: number;
  readonly researchUnfundedReason?: ResearchUnfundedReason;
  readonly plannedConstruction: number;
  readonly projectedNet: number;
  readonly shortfall: number;
  readonly status: EconomyStatus;
  readonly monthEndTreasury: number;
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
  readonly readiness: string;
  readonly crewQuality: number;
  readonly stationAssignment?: "FOREIGN_STATION";
  readonly colonialServiceFitted?: true;
  readonly overBase?: true;
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

export interface PlayerProjectionPresenceArea {
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTons: number;
  readonly shortfallTons: number;
}

export type PlayerProjectionPresence =
  | { readonly configured: false }
  | {
      readonly configured: true;
      readonly exempt: boolean;
      readonly areas: readonly PlayerProjectionPresenceArea[];
    };

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
  readonly playerNationId: string;
  readonly nationName: string;
  readonly projectedSurplusDeficit: number;
  readonly economy: PlayerProjectionEconomy;
  readonly fleet: readonly PlayerProjectionFleet[];
  readonly ports: readonly PlayerProjectionPort[];
  readonly knownTechnologyIds: readonly string[];
  readonly strategicAreas: readonly PlayerProjectionStrategicArea[];
  readonly knownEnemyNations: readonly string[];
  readonly presence?: PlayerProjectionPresence;
  readonly commandWorkspace: PlayerProjectionCommandWorkspace;
}

export function buildPresenceReadout(
  snapshot: Parameters<typeof measurePresence>[0] & Parameters<typeof isPresenceExempt>[0],
  nationId: string,
  month: PlayerProjectionMonth,
  presenceRules?: PresenceMeasurementRules,
): PlayerProjectionPresence {
  if (presenceRules === undefined) return { configured: false };
  const exempt = isPresenceExempt(snapshot, nationId, monthId(month.year, month.month));
  return {
    configured: true,
    exempt,
    areas: measurePresence(snapshot, presenceRules)
      .filter((row) => row.nationId === nationId)
      .map(({ areaId, requiredTons, presentTons, shortfallTons }) => ({
        areaId,
        requiredTons,
        presentTons,
        shortfallTons: exempt ? 0 : shortfallTons,
      })),
  };
}

export function buildPlayerProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
  presenceRules?: PresenceMeasurementRules,
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
            ...(ship.colonialServiceFitted === true
              ? { colonialServiceFitted: true as const }
              : {}),
            ...(ship.overBase === undefined ? {} : { overBase: true as const }),
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
    presence: buildPresenceReadout(snapshot, playerSlotId, month, presenceRules),
    commandWorkspace: { commands: [], movementCommands: [] },
  };
}
