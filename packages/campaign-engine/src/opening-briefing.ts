import type { CampaignState } from "@bluewave/campaign";
import { isShipOperational } from "@bluewave/campaign";
import { buildDiplomacyScreenProjection } from "./diplomacy.js";
import { constructionShipTypeLabel, projectedConstructionOrderCosts } from "./construction.js";
import { derivePlayerFacts, isLowResearchSpending, isNearCompletion } from "./player-facts.js";
import type { PlayerProjectionMonth } from "./projection.js";

export { totalPaidWork } from "./player-facts.js";

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

export function buildOpeningBriefingProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
): OpeningBriefingProjection | undefined {
  const snapshot = state.snapshot;
  const facts = derivePlayerFacts(snapshot, playerSlotId);
  if (facts === undefined) return undefined;
  const { nation, outlook, largestDockCapacity, constructionCommitted } = facts;

  const shipClassCounts = new Map<string, number>();
  for (const { design } of facts.ships) {
    const label = design ? constructionShipTypeLabel(design.hullType) : "unknown";
    shipClassCounts.set(label, (shipClassCounts.get(label) ?? 0) + 1);
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
  for (const { ship, design } of facts.ships) {
    if (!isShipOperational(ship) || design === undefined) continue;
    const cost = projectedConstructionOrderCosts(design).projectedCost;
    if (mostExpensiveActiveClass === null || cost > mostExpensiveActiveClass.projectedCost) {
      mostExpensiveActiveClass = { className: design.className, projectedCost: cost };
    }
  }

  const fleetMaintenance = outlook.maintenance;

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
  const hasNearCompleteProject = nation.constructionProjects.some(isNearCompletion);

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
  if (governmentAllocation <= 0 || isLowResearchSpending(outlook)) {
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
