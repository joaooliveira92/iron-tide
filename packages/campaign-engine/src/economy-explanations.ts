import { ECONOMY_RATE_DENOMINATOR, type EconomyOutlook } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const ECONOMY_FORMULA_VERSION = "economy_v1";

const SOURCE = { kind: "code", ref: "packages/campaign/src/economyOutlook.ts" } as const;
const UNIT_MONEY = "nc";

function moneyChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, ECONOMY_FORMULA_VERSION)
    .withInput("amount", Math.abs(amount))
    .withResult(amount)
    .withUnit(UNIT_MONEY)
    .withSource(SOURCE)
    .build();
}

export function explainEconomyNet(outlook: EconomyOutlook): ExplanationTree {
  const builder = new ExplanationBuilder("economy_net", ECONOMY_FORMULA_VERSION)
    .withInput("appropriation", outlook.revenue)
    .withIntermediate(
      "outflow",
      outlook.obligations + outlook.maintenance + outlook.plannedResearch,
    )
    .withResult(outlook.projectedNet)
    .withUnit(UNIT_MONEY)
    .withOperation("subtract")
    .withSource(SOURCE)
    .addChild(moneyChild("economy_net.appropriation", outlook.revenue));
  for (const [key, amount] of [
    ["obligations", outlook.obligations],
    ["maintenance", outlook.maintenance],
    ["research", outlook.plannedResearch],
  ] as const) {
    if (amount !== 0) builder.addChild(moneyChild(`economy_net.${key}`, -amount));
  }
  return builder.build();
}

export function explainEconomyMonthEnd(outlook: EconomyOutlook, treasury: number): ExplanationTree {
  const builder = new ExplanationBuilder("economy_month_end", ECONOMY_FORMULA_VERSION)
    .withInput("treasury", treasury)
    .withInput("appropriation", outlook.revenue)
    .withIntermediate("shortfall", outlook.shortfall)
    .withResult(outlook.monthEndTreasury)
    .withUnit(UNIT_MONEY)
    .withOperation("add")
    .withSource(SOURCE)
    .addChild(moneyChild("economy_month_end.treasury", treasury))
    .addChild(moneyChild("economy_month_end.appropriation", outlook.revenue));
  const settled = [
    ["carrying", outlook.settlement.carryingPaid],
    ["construction", outlook.settlement.buildingPaid],
    ["maintenance", outlook.settlement.maintenancePaid],
    ["obligations", outlook.settlement.obligationsPaid],
    ["research", outlook.settlement.researchPaid],
  ] as const;
  for (const [key, amount] of settled) {
    if (amount !== 0) builder.addChild(moneyChild(`economy_month_end.${key}`, -amount));
  }
  return builder.build();
}

export function explainEconomyRunway(
  outlook: EconomyOutlook,
  treasury: number,
): ExplanationTree | undefined {
  if (outlook.runwayMonths === undefined) return undefined;
  const deficit = -outlook.projectedNet;
  return new ExplanationBuilder("economy_runway", ECONOMY_FORMULA_VERSION)
    .withInput("treasury", treasury)
    .withInput("monthlyDeficit", deficit)
    .withResult(outlook.runwayMonths)
    .withUnit("months")
    .withOperation("divide")
    .withSource(SOURCE)
    .addChild(moneyChild("economy_runway.treasury", treasury))
    .addChild(moneyChild("economy_runway.monthlyDeficit", deficit))
    .build();
}

export function explainAppropriation(
  baseResources: number,
  rateBp: number,
  revenue: number,
): ExplanationTree {
  return new ExplanationBuilder("economy_appropriation", ECONOMY_FORMULA_VERSION)
    .withInput("baseResources", baseResources)
    .withInput("appropriationRateBp", rateBp)
    .withIntermediate("rateDenominator", ECONOMY_RATE_DENOMINATOR)
    .withResult(revenue)
    .withUnit(UNIT_MONEY)
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(moneyChild("economy_appropriation.baseResources", baseResources))
    .addChild(
      new ExplanationBuilder("economy_appropriation.appropriationRate", ECONOMY_FORMULA_VERSION)
        .withInput("rateBp", rateBp)
        .withResult(rateBp)
        .withUnit("bp")
        .withSource(SOURCE)
        .build(),
    )
    .build();
}
