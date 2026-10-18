// The month ahead, seen by the same calculators the month executor uses (spec #138 slice 6). Every projection — status strip,
// Treasury screen, opening briefing, priorities — reads this, so the screen never contradicts the ledger it is about to
// produce. Pure, integer-only, derived from the immutable snapshot; no formula lives in the UI.
import { SafeInt } from "@bluewave/contracts";
import {
  monthlyNetBeforeConstruction,
  monthlyRevenue,
  researchCap,
  runwayMonths,
  settleOutflow,
} from "./economy.js";
import { nationIsAtWar, nationMonthlyMaintenance } from "./maintenance.js";
import { eligibleResearchFields, technologyCatalogueOf } from "./researchEligibility.js";
import type { CampaignSnapshot, ConstructionProject, NationState } from "./state.js";

/** The qualitative band of a month's net before construction, relative to the monthly revenue (spec #138 G6). */
export type EconomyStatus = "healthy" | "narrow" | "deficit" | "critical";

/**
 * Bands a projected net by integer comparison against the monthly revenue baseline (a zero or negative revenue baselines at 1
 * so a degenerate nation still classifies): healthy from 25% of revenue, narrow from break-even, deficit down to -10% of
 * revenue, critical below. The thresholds are the opening briefing's; every surface reads the same band.
 */
export function economyStatus(net: number, revenue: number): EconomyStatus {
  const baseline = revenue > 0 ? revenue : 1;
  if (net * 4 >= baseline) return "healthy";
  if (net >= 0) return "narrow";
  if (net * 10 >= -baseline) return "deficit";
  return "critical";
}

/** Why a standing research budget is not paid next month; absent when it is (or when none is set). */
export type ResearchUnfundedReason = "NO_ELIGIBLE_RESEARCH_FIELD" | "ABOVE_CAP";

export interface EconomyOutlook {
  /** Monthly revenue: `floor(base x rate / 120000)`. */
  readonly revenue: number;
  /** Fixed monthly obligations (`expenses`). */
  readonly obligations: number;
  /** Fleet maintenance requested, war-aware. */
  readonly maintenance: number;
  /** The standing monthly research budget as set. */
  readonly researchRequested: number;
  /** The research the engine will actually draw: the budget when a field can take it, else 0. */
  readonly plannedResearch: number;
  /** The most research the nation may fund: `floor(12% x revenue)`. */
  readonly researchCap: number;
  /** Set when the standing budget is not paid, so the player can see why. */
  readonly researchUnfundedReason?: ResearchUnfundedReason;
  /** An upper bound on construction work next month: what the yards can absorb, before the treasury limits it. */
  readonly plannedConstruction: number;
  /** Revenue less obligations, maintenance and planned research: the net before construction. */
  readonly projectedNet: number;
  /** Unpaid obligations, maintenance and research if the month ran with construction at its upper bound. */
  readonly shortfall: number;
  /** The band of `projectedNet` against `revenue`; the one status every surface shows. */
  readonly status: EconomyStatus;
  /** The treasury after that month (never negative: a shortfall is not carried). */
  readonly monthEndTreasury: number;
  /** Whole months the treasury lasts at a negative net; absent when the net is not negative. */
  readonly runwayMonths?: number;
}

const TERMINAL_OR_HELD = new Set(["COMPLETED", "CANCELLED", "HALTED", "DELAYED"]);

/** The most a project can take in a month: its remaining work, bounded by its summed line throughput when it has one. */
function monthlyAbsorbable(project: ConstructionProject, snapshot: CampaignSnapshot): number {
  const remaining = (project["totalWork"] as number) - (project["completedWork"] as number);
  if (remaining <= 0) return 0;
  const capacity =
    project["capacityUnits"] ??
    snapshot["designs"].get(project["designVersionId"])?.["constructionPlan"]?.["capacityUnits"];
  if (capacity === undefined) return remaining;
  const throughput = Object.values(capacity).reduce((sum, units) => sum + (units as number), 0);
  return throughput > 0 ? Math.min(remaining, throughput) : remaining;
}

function plannedConstructionOf(nation: NationState, snapshot: CampaignSnapshot): number {
  let total = 0;
  for (const project of nation["constructionProjects"]) {
    if (TERMINAL_OR_HELD.has(project["status"])) continue;
    // A foreign order is paid by its contract schedule, never by ordinary appropriation.
    if (project["foreignContractId"] !== undefined) continue;
    total += monthlyAbsorbable(project, snapshot);
  }
  return total;
}

/**
 * The outlook for `nationId`'s next month, or undefined when the nation does not exist. It settles the flows in the engine's
 * phase order — revenue, construction (only from funds beyond the obligation reserve), maintenance, obligations, research —
 * with construction at its upper bound, so `shortfall` and `monthEndTreasury` are the prudent case.
 */
export function economyOutlook(
  snapshot: CampaignSnapshot,
  nationId: string,
): EconomyOutlook | undefined {
  const nation = snapshot["nations"].get(nationId);
  if (nation === undefined) return undefined;

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

  const planned = plannedConstructionOf(nation, snapshot);
  const net = monthlyNetBeforeConstruction({ revenue, obligations, maintenance, research });

  // Settle in phase order against the funds the month opens with.
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
