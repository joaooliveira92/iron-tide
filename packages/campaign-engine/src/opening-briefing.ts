import type { CampaignState } from "@bluewave/campaign";
import { economyOutlook, isShipOperational } from "@bluewave/campaign";
import { buildDiplomacyScreenProjection } from "./diplomacy.js";
import { constructionShipTypeLabel, projectedConstructionOrderCosts } from "./construction.js";
import type { PlayerProjectionMonth } from "./projection.js";

export interface OpeningBriefingShipClassCount {
  readonly label: string;
  readonly count: number;
}

export interface OpeningBriefingArea {
  readonly areaId: string;
  readonly name: string;
}

export interface OpeningBriefingRelationsRow {
  readonly nationId: string;
  readonly name: string;
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement";
  readonly tension: number;
  readonly nap: boolean;
  readonly controlledAreas: readonly OpeningBriefingArea[];
}

export type OpeningBriefingTreasuryStatus = "healthy" | "narrow" | "deficit" | "critical";

export interface OpeningBriefingConcern {
  readonly category:
    | "obsolescence"
    | "budget_shortfall"
    | "near_complete_construction"
    | "low_research_spending";
  readonly message: string;
}

export interface OpeningBriefingProjection {
  readonly nationId: string;
  readonly nationName: string;
  readonly month: PlayerProjectionMonth;
  readonly stateOfTheNavy: {
    readonly shipClassCounts: readonly OpeningBriefingShipClassCount[];
    readonly shipsUnderConstruction: number;
    readonly mostExpensiveActiveClass: {
      readonly className: string;
      readonly projectedCost: number;
    } | null;
    readonly largestDockCapacity: number;
    readonly totalMaintenance: number;
    readonly constructionCommitted: number;
  };
  readonly treasury: {
    readonly governmentAllocation: number;
    readonly fleetMaintenance: number;
    readonly constructionCommitted: number;
    readonly researchExpenditure: number;
    readonly projectedSurplus: number;
    readonly status: OpeningBriefingTreasuryStatus;
    readonly obligations: number;
    readonly runwayMonths?: number;
  };
  readonly foreignIntelligence: {
    readonly relations: readonly OpeningBriefingRelationsRow[];
    readonly playerAreas: readonly OpeningBriefingArea[];
  };
  readonly immediateConcerns: readonly OpeningBriefingConcern[];
}

import {
  MAINTENANCE_FORMULA_ID,
  MAINTENANCE_FORMULA_VERSION,
  shipMaintenanceCost,
} from "@bluewave/campaign";
export { MAINTENANCE_FORMULA_ID, MAINTENANCE_FORMULA_VERSION, shipMaintenanceCost };

export function totalPaidWork(nation: {
  readonly constructionProjects: readonly { readonly paidWork: unknown }[];
}): number {
  return nation.constructionProjects.reduce((sum, project) => sum + Number(project.paidWork), 0);
}

export function buildOpeningBriefingProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
): OpeningBriefingProjection | undefined {
  const snapshot = state.snapshot;
  const nation = snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  const shipClassCounts = new Map<string, number>();
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      const design = snapshot.designs.get(ship.designVersionId);
      const label = design ? constructionShipTypeLabel(design.hullType) : "unknown";
      shipClassCounts.set(label, (shipClassCounts.get(label) ?? 0) + 1);
    }
  }
  const sortedShipClassCounts: OpeningBriefingShipClassCount[] = [...shipClassCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  const shipsUnderConstruction = nation.constructionProjects.filter(
    (project) => project.type === "ship" && project.status !== "COMPLETED",
  ).length;

  let mostExpensiveActiveClass: {
    readonly className: string;
    readonly projectedCost: number;
  } | null = null;
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      if (!isShipOperational(ship)) continue;
      const design = snapshot.designs.get(ship.designVersionId);
      if (design === undefined) continue;
      const cost = projectedConstructionOrderCosts(design).projectedCost;
      if (mostExpensiveActiveClass === null || cost > mostExpensiveActiveClass.projectedCost) {
        mostExpensiveActiveClass = { className: design.className, projectedCost: cost };
      }
    }
  }

  const largestDockCapacity = snapshot.world.ports
    .filter((port) => port.nationId === playerSlotId)
    .reduce((max, port) => Math.max(max, Number(port.level)), 0);

  const outlook = economyOutlook(snapshot, playerSlotId)!;
  const fleetMaintenance = outlook.maintenance;

  const constructionCommitted = totalPaidWork(nation);

  const governmentAllocation = outlook.revenue;
  const researchExpenditure = outlook.plannedResearch;
  const projectedSurplus = outlook.projectedNet;

  const controlledAreas = (nationId: string): OpeningBriefingArea[] =>
    snapshot.world.areas
      .filter((area) => area.controller === nationId)
      .map((area) => ({ areaId: area.id, name: area.name }))
      .sort((a, b) => a.areaId.localeCompare(b.areaId));
  const relations: OpeningBriefingRelationsRow[] = (
    buildDiplomacyScreenProjection(state, playerSlotId, month)?.relations ?? []
  ).map((relation) => ({
    nationId: relation.partnerNationId,
    name: relation.partnerName,
    relation: relation.relation,
    tension: relation.tension,
    nap: relation.nap,
    controlledAreas: controlledAreas(relation.partnerNationId),
  }));

  const hasCapitalShip = [...shipClassCounts.entries()].some(
    ([label, count]) => count > 0 && (label === "battleship" || label === "battlecruiser"),
  );
  const hasNearCompleteProject = nation.constructionProjects.some((project) => {
    const total = Number(project.totalWork);
    return (
      total > 0 && Number(project.completedWork) / total >= 0.9 && project.status !== "COMPLETED"
    );
  });

  const immediateConcerns: OpeningBriefingConcern[] = [];
  if (!hasCapitalShip) {
    immediateConcerns.push({
      category: "obsolescence",
      message:
        "Your battle line lacks a modern capital ship. Authorizing a new battleship class should be a priority.",
    });
  }
  if (projectedSurplus < 0 || outlook.shortfall > 0) {
    immediateConcerns.push({
      category: "budget_shortfall",
      message:
        "The projected monthly budget runs a deficit. Review maintenance, construction, and research spending.",
    });
  }
  if (hasNearCompleteProject) {
    immediateConcerns.push({
      category: "near_complete_construction",
      message:
        "A hull is nearing completion and will soon demand crew, armament, and operating funds.",
    });
  }
  if (governmentAllocation <= 0 || researchExpenditure * 10 < governmentAllocation) {
    immediateConcerns.push({
      category: "low_research_spending",
      message:
        "Research spending is low relative to the naval budget. Investment here drives future ship classes.",
    });
  }

  return {
    nationId: playerSlotId,
    nationName: nation.name,
    month,
    stateOfTheNavy: {
      shipClassCounts: sortedShipClassCounts,
      shipsUnderConstruction,
      mostExpensiveActiveClass,
      largestDockCapacity,
      totalMaintenance: fleetMaintenance,
      constructionCommitted,
    },
    treasury: {
      governmentAllocation,
      fleetMaintenance,
      constructionCommitted,
      researchExpenditure,
      projectedSurplus,
      status: outlook.status,
      obligations: outlook.obligations,
      ...(outlook.runwayMonths === undefined ? {} : { runwayMonths: outlook.runwayMonths }),
    },
    foreignIntelligence: { relations, playerAreas: controlledAreas(playerSlotId) },
    immediateConcerns,
  };
}
