import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  EconomyOutlook,
  FleetState,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { economyOutlook } from "@bluewave/campaign";
import { MIN_RESEARCH_SHARE_BP, NEAR_COMPLETION_WORK_RATIO } from "./priorityConstants.js";
import { compareCodePoints } from "@bluewave/deterministic";

const BASIS_POINTS = 10_000;

export interface PlayerFactsPort {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly capacity: number;
}

export interface PlayerFactsShip {
  readonly fleet: FleetState;
  readonly ship: Ship;
  readonly design: CompiledDesignVersion | undefined;
}

export interface PlayerFactsFleet {
  readonly fleet: FleetState;
  readonly ships: readonly PlayerFactsShip[];
}

export interface PlayerFacts {
  readonly nation: NationState;
  readonly outlook: EconomyOutlook;
  readonly ports: readonly PlayerFactsPort[];
  readonly shipyardCapacity: number;
  readonly largestDockCapacity: number;
  readonly constructionCommitted: number;
  readonly fleets: readonly PlayerFactsFleet[];
  readonly ships: readonly PlayerFactsShip[];
}

export function totalPaidWork(nation: {
  readonly constructionProjects: readonly { readonly paidWork: unknown }[];
}): number {
  return nation.constructionProjects.reduce((sum, project) => sum + Number(project.paidWork), 0);
}

export function isNearCompletion(
  project: Pick<ConstructionProject, "status" | "totalWork" | "completedWork">,
): boolean {
  if (project.status === "COMPLETED") return false;
  const total = Number(project.totalWork);
  return total > 0 && Number(project.completedWork) / total >= NEAR_COMPLETION_WORK_RATIO;
}

export function isLowResearchSpending(
  outlook: Pick<EconomyOutlook, "revenue" | "plannedResearch">,
): boolean {
  return (
    outlook.revenue > 0 &&
    outlook.plannedResearch * BASIS_POINTS < outlook.revenue * MIN_RESEARCH_SHARE_BP
  );
}

export function derivePlayerFacts(
  snapshot: CampaignSnapshot,
  playerNationId: string,
): PlayerFacts | undefined {
  const nation = snapshot.nations.get(playerNationId);
  const outlook = economyOutlook(snapshot, playerNationId);
  if (nation === undefined || outlook === undefined) return undefined;

  const ports: PlayerFactsPort[] = snapshot.world.ports
    .filter((port) => port.nationId === playerNationId)
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      capacity: Number(port.level),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const fleets: PlayerFactsFleet[] = nation.fleets.map((fleet) => ({
    fleet,
    ships: fleet.ships.map((ship) => ({
      fleet,
      ship,
      design: snapshot.designs.get(ship.designVersionId),
    })),
  }));

  return {
    nation,
    outlook,
    ports,
    shipyardCapacity: ports.reduce((sum, port) => sum + port.capacity, 0),
    largestDockCapacity: ports.reduce((max, port) => Math.max(max, port.capacity), 0),
    constructionCommitted: totalPaidWork(nation),
    fleets,
    ships: fleets.flatMap((entry) => entry.ships),
  };
}
