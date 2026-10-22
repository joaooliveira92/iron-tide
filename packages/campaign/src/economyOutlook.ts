import { SafeInt } from "@bluewave/contracts";
import { monthlyAbsorbable } from "./constructionDraw.js";
import {
  monthlyNetBeforeConstruction,
  monthlyRevenue,
  researchCap,
  runwayMonths,
  settleOutflow,
} from "./economy.js";
import { nationIsAtWar, nationMonthlyMaintenance } from "./maintenance.js";
import { eligibleResearchFields, technologyCatalogueOf } from "./researchEligibility.js";
import type { CampaignSnapshot, NationState } from "./state.js";
import { campaignMonthId } from "./timeline.js";

export type EconomyStatus = "healthy" | "narrow" | "deficit" | "critical";

export function economyStatus(net: number, revenue: number): EconomyStatus {
  const baseline = revenue > 0 ? revenue : 1;
  if (net * 4 >= baseline) return "healthy";
  if (net >= 0) return "narrow";
  if (net * 10 >= -baseline) return "deficit";
  return "critical";
}

export type ResearchUnfundedReason = "NO_ELIGIBLE_RESEARCH_FIELD" | "ABOVE_CAP";

export interface EconomyOutlook {
  readonly revenue: number;
  readonly obligations: number;
  readonly maintenance: number;
  readonly researchRequested: number;
  readonly plannedResearch: number;
  readonly researchCap: number;
  readonly researchUnfundedReason?: ResearchUnfundedReason;
  readonly plannedConstruction: number;
  readonly projectedNet: number;
  readonly shortfall: number;
  readonly status: EconomyStatus;
  readonly monthEndTreasury: number;
  readonly runwayMonths?: number;
}

const TERMINAL_OR_HELD = new Set(["COMPLETED", "CANCELLED", "HALTED", "DELAYED"]);

function plannedConstructionOf(
  nation: NationState,
  snapshot: CampaignSnapshot,
  month: string,
): number {
  let total = 0;
  for (const project of nation["constructionProjects"]) {
    if (TERMINAL_OR_HELD.has(project["status"])) continue;
    if (project["foreignContractId"] !== undefined) continue;
    total += monthlyAbsorbable(
      project,
      project["capacityUnits"] ??
        snapshot["designs"].get(project["designVersionId"])?.["constructionPlan"]?.[
          "capacityUnits"
        ],
      month,
    );
  }
  return total;
}

export function economyOutlook(
  snapshot: CampaignSnapshot,
  nationId: string,
): EconomyOutlook | undefined {
  const nation = snapshot["nations"].get(nationId);
  if (nation === undefined) return undefined;

  const month = campaignMonthId(
    snapshot["startYear"],
    snapshot["startMonth"],
    snapshot["turnNumber"] as number,
  );
  const revenue = monthlyRevenue(nation["baseResources"], nation["navalAppropriationRateBp"]);
  const maintenance = nationMonthlyMaintenance(
    nation["fleets"],
    nationIsAtWar(snapshot["wars"]["wars"], nationId),
  );
  const obligations = nation["expenses"];
  const cap = researchCap(revenue);

  const requested = nation["research"]["researchBudget"];
  const hasField =
    eligibleResearchFields(
      nation["research"],
      snapshot["turnNumber"],
      technologyCatalogueOf(snapshot),
    ).length > 0;
  const research = hasField ? requested : SafeInt.ZERO;
  let unfundedReason: ResearchUnfundedReason | undefined;
  if ((requested as number) > 0 && !hasField) unfundedReason = "NO_ELIGIBLE_RESEARCH_FIELD";
  else if ((requested as number) > (cap as number)) unfundedReason = "ABOVE_CAP";

  const planned = plannedConstructionOf(nation, snapshot, month);
  const net = monthlyNetBeforeConstruction({ revenue, obligations, maintenance, research });

  let funds = SafeInt.add(nation["treasury"], revenue);
  const constructionRoom = SafeInt.sub(funds, obligations);
  const construction = SafeInt(Math.min(planned, Math.max(0, constructionRoom as number)));
  funds = SafeInt.sub(funds, construction);
  let shortfall = SafeInt.ZERO;
  for (const outflow of [maintenance, obligations, research]) {
    const settlement = settleOutflow(outflow, funds);
    funds = SafeInt.sub(funds, settlement.paid);
    shortfall = SafeInt.add(shortfall, settlement.shortfall);
  }

  const runway = runwayMonths(nation["treasury"], net);
  return {
    revenue: revenue as number,
    obligations: obligations as number,
    maintenance: maintenance as number,
    researchRequested: requested as number,
    plannedResearch: research as number,
    researchCap: cap as number,
    ...(unfundedReason === undefined ? {} : { researchUnfundedReason: unfundedReason }),
    plannedConstruction: planned,
    projectedNet: net as number,
    status: economyStatus(net as number, revenue as number),
    shortfall: shortfall as number,
    monthEndTreasury: Math.max(0, funds as number),
    ...(runway === undefined ? {} : { runwayMonths: runway }),
  };
}
