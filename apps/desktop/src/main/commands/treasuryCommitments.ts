import {
  applyPrestigeRule,
  campaignMonthId,
  economyOutlook,
  fleetMaintenanceBreakdown,
  nationIsAtWar,
  nationMaintenanceAdders,
  type CampaignSnapshot,
  type ConstructionProject,
  type NationState,
} from "@bluewave/campaign";
import {
  accelerationDelayEligible,
  accelerationPremiumAlreadyApplied,
  accelerationPremiumWork,
  constructionProjectQueueWithReadouts,
  nationAccelerationPressureOf,
} from "@bluewave/phase-engine";
import {
  accelerationTermsOf,
  type AccelerationTerms,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { Result } from "effect";
import type {
  ConstructionAcceleration,
  ConstructionCommitment,
  ProjectAcceleration,
  TreasuryCommitments,
  UnpaidCostsPrestige,
} from "../../shared/budget-contract.js";
import { economyOutlookOptions } from "./economyOutlookOptions.js";
import { loadShipBuildingContent } from "../shipBuildingContent.js";

function unpaidCostsPrestige(
  snapshot: CampaignSnapshot,
  nation: NationState,
  triggered: boolean,
): UnpaidCostsPrestige | null {
  const change = applyPrestigeRule(Number(nation.prestige), "UNPAID_FUNDS", snapshot.prestigeRules);
  if (Result.isFailure(change)) return null;
  return {
    triggered,
    before: Number(change.success.before),
    after: Number(change.success.after),
    sackingThreshold: Number(snapshot.prestigeRules.sackingThreshold),
  };
}

const BP = 10_000;

function projectAcceleration(
  project: ConstructionProject,
  terms: AccelerationTerms,
): ProjectAcceleration | null {
  if (project.status !== "ACCELERATED") return null;
  const premiumApplied = accelerationPremiumAlreadyApplied(project);
  const remaining = Number(project.totalWork) - Number(project.completedWork);
  return {
    premiumApplied,
    premiumWork: premiumApplied ? 0 : accelerationPremiumWork(Math.max(0, remaining), terms),
  };
}

function nationAcceleration(
  snapshot: CampaignSnapshot,
  nation: NationState,
  month: string,
  terms: AccelerationTerms,
  perProject: ReadonlyMap<string, ProjectAcceleration>,
): ConstructionAcceleration {
  const pressure = nationAccelerationPressureOf(
    nation.constructionProjects,
    (project) =>
      project.capacityUnits ??
      snapshot.designs.get(project.designVersionId)?.constructionPlan?.capacityUnits,
    month,
    terms,
  );
  return {
    acceleratedCount: perProject.size,
    delayChanceBp:
      perProject.size > 0 && accelerationDelayEligible(pressure.capacityPressureBp, terms)
        ? pressure.delayProbabilityBp
        : 0,
    premiumBp: terms.workMultiplierBp - BP,
    premiumPending: [...perProject.values()].reduce((sum, entry) => sum + entry.premiumWork, 0),
  };
}

export function buildTreasuryCommitments(
  snapshot: CampaignSnapshot,
  nation: NationState,
): TreasuryCommitments {
  const month = campaignMonthId(snapshot.startYear, snapshot.startMonth, snapshot.turnNumber);
  const content: ShipBuildingContent = loadShipBuildingContent();
  const environment = content.environmentFor(month);
  const terms = accelerationTermsOf(environment.constructionBalance, environment.costBalance);
  const outlook = economyOutlook(
    snapshot,
    nation.id,
    economyOutlookOptions(snapshot, nation.id, content, month),
  );
  const upkeep = fleetMaintenanceBreakdown(
    nation.fleets,
    nationIsAtWar(snapshot.wars.wars, nation.id),
    nationMaintenanceAdders(nation, month),
  );
  const draws = new Map(
    (outlook?.constructionDraws ?? []).map((entry) => [entry.projectId, entry.draw]),
  );
  const queue = constructionProjectQueueWithReadouts(snapshot, nation.id, content, month);
  const accelerated = new Map<string, ProjectAcceleration>();
  for (const project of nation.constructionProjects) {
    const acceleration = projectAcceleration(project, terms);
    if (acceleration !== null) accelerated.set(project.id, acceleration);
  }
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
      acceleration: accelerated.get(entry.projectId) ?? null,
    }));
  return {
    fleet: upkeep,
    construction: {
      projects,
      drawTotal: projects.reduce((sum, project) => sum + project.draw, 0),
      carryingTotal: projects.reduce((sum, project) => sum + project.carryingCost, 0),
      haltedCount: projects.filter((project) => project.status === "HALTED").length,
      acceleration: nationAcceleration(snapshot, nation, month, terms, accelerated),
    },
    unpaidCostsPrestige: unpaidCostsPrestige(
      snapshot,
      nation,
      (outlook?.obligationShortfall ?? 0) > 0,
    ),
  };
}
