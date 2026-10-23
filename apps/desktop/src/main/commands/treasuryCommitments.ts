import {
  applyPrestigeRule,
  campaignMonthId,
  constructionDrawByProject,
  fleetMaintenanceBreakdown,
  nationIsAtWar,
  type CampaignSnapshot,
  type NationState,
} from "@bluewave/campaign";
import { constructionProjectQueueWithReadouts } from "@bluewave/phase-engine";
import type {
  ConstructionCommitment,
  TreasuryCommitments,
  UnpaidCostsPrestige,
} from "../../shared/budget-contract.js";
import { loadShipBuildingContent } from "../shipBuildingContent.js";

function unpaidCostsPrestige(
  snapshot: CampaignSnapshot,
  nation: NationState,
): UnpaidCostsPrestige | null {
  const change = applyPrestigeRule(Number(nation.prestige), "UNPAID_FUNDS", snapshot.prestigeRules);
  if (!change.ok) return null;
  return {
    before: Number(change.value.before),
    after: Number(change.value.after),
    sackingThreshold: Number(snapshot.prestigeRules.sackingThreshold),
  };
}

export function buildTreasuryCommitments(
  snapshot: CampaignSnapshot,
  nation: NationState,
): TreasuryCommitments {
  const month = campaignMonthId(snapshot.startYear, snapshot.startMonth, snapshot.turnNumber);
  const upkeep = fleetMaintenanceBreakdown(
    nation.fleets,
    nationIsAtWar(snapshot.wars.wars, nation.id),
  );
  const draws = new Map(
    constructionDrawByProject(nation, snapshot, month).map((entry) => [
      entry.projectId,
      entry.draw,
    ]),
  );
  const queue = constructionProjectQueueWithReadouts(
    snapshot,
    nation.id,
    loadShipBuildingContent(),
    month,
  );
  const projects: ConstructionCommitment[] = queue
    .filter((entry) => entry.status !== "COMPLETED" && entry.status !== "CANCELLED")
    .map((entry) => ({
      projectId: entry.projectId,
      className: entry.className,
      shipType: entry.shipType,
      status: entry.status,
      draw: draws.get(entry.projectId) ?? 0,
      carryingCost: entry.status === "HALTED" ? (entry.readout?.haltedCarryingCostUnits ?? 0) : 0,
      foreign: entry.isForeign,
      percentComplete:
        entry.totalWork > 0 ? Math.floor((entry.completedWork * 100) / entry.totalWork) : 0,
    }));
  return {
    fleet: upkeep,
    construction: {
      projects,
      drawTotal: projects.reduce((sum, project) => sum + project.draw, 0),
      carryingTotal: projects.reduce((sum, project) => sum + project.carryingCost, 0),
      haltedCount: projects.filter((project) => project.status === "HALTED").length,
    },
    unpaidCostsPrestige: unpaidCostsPrestige(snapshot, nation),
  };
}
