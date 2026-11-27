import type {
  CampaignSnapshot,
  ColonyIncomeRules,
  EconomyOutlookOptions,
  ResearchReturnsRules,
} from "@bluewave/campaign";
import { accelerationTermsFor, constructionProjectQueueWithReadouts } from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { loadBaseGrowthRules, loadTradeProtectionRules } from "../shipBuildingContent.js";

export function economyOutlookOptions(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent,
  month: string,
  researchReturns: ResearchReturnsRules | undefined,
  colonyIncome: ColonyIncomeRules | undefined,
): EconomyOutlookOptions {
  const projects = snapshot.nations.get(nationId)?.constructionProjects ?? [];
  const terms = accelerationTermsFor(content, month);
  const baseGrowth = loadBaseGrowthRules();
  const tradeProtection = loadTradeProtectionRules();
  const base: EconomyOutlookOptions = {
    ...(baseGrowth === undefined ? {} : { baseGrowth }),
    ...(tradeProtection === undefined ? {} : { tradeProtection }),
    ...(terms === undefined ? {} : { acceleration: terms }),
    ...(researchReturns === undefined ? {} : { researchReturns }),
    ...(colonyIncome === undefined ? {} : { colonyIncome }),
  };
  const halted = projects.some((project) => project.status === "HALTED");
  if (!halted) return base;
  const queue = constructionProjectQueueWithReadouts(snapshot, nationId, content, month);
  const carrying = queue.find((entry) => entry.status === "HALTED")?.readout
    ?.haltedCarryingCostUnits;
  return carrying === null || carrying === undefined
    ? base
    : { ...base, carryingCostPerHaltedProject: carrying };
}
