import { RESEARCH_SHARE_CAP_BP } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";
import { MIN_RESEARCH_SHARE_BP } from "./priorityConstants.js";

export const RESEARCH_FORMULA_VERSION = "research_v1";

const SOURCE = { kind: "code", ref: "packages/campaign-engine/src/research.ts" } as const;
const UNIT_MONEY = "nc";

function moneyChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, RESEARCH_FORMULA_VERSION)
    .withInput("amount", amount)
    .withResult(amount)
    .withUnit(UNIT_MONEY)
    .withSource(SOURCE)
    .build();
}

function shareChild(formulaId: string, shareBp: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, RESEARCH_FORMULA_VERSION)
    .withInput("shareBp", shareBp)
    .withResult(shareBp)
    .withUnit("bp")
    .withSource(SOURCE)
    .build();
}

export function explainResearchCap(revenue: number, cap: number): ExplanationTree {
  return new ExplanationBuilder("research_cap", RESEARCH_FORMULA_VERSION)
    .withInput("appropriation", revenue)
    .withIntermediate("shareCapBp", RESEARCH_SHARE_CAP_BP)
    .withResult(cap)
    .withUnit(UNIT_MONEY)
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(moneyChild("research_cap.appropriation", revenue))
    .addChild(shareChild("research_cap.shareCap", RESEARCH_SHARE_CAP_BP))
    .build();
}

export function explainResearchFloor(revenue: number, floor: number): ExplanationTree {
  return new ExplanationBuilder("research_floor", RESEARCH_FORMULA_VERSION)
    .withInput("appropriation", revenue)
    .withIntermediate("guidanceShareBp", MIN_RESEARCH_SHARE_BP)
    .withResult(floor)
    .withUnit(UNIT_MONEY)
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(moneyChild("research_floor.appropriation", revenue))
    .addChild(shareChild("research_floor.guidanceShare", MIN_RESEARCH_SHARE_BP))
    .build();
}

export function explainResearchBudget(
  requested: number,
  cap: number,
  paid: number,
  hasEligibleField: boolean,
): ExplanationTree {
  const builder = new ExplanationBuilder("research_budget", RESEARCH_FORMULA_VERSION)
    .withInput("requested", requested)
    .withInput("cap", cap)
    .withInput("hasEligibleField", hasEligibleField ? "true" : "false")
    .withResult(paid)
    .withUnit(UNIT_MONEY)
    .withOperation("clamp")
    .withSource(SOURCE)
    .addChild(moneyChild("research_budget.requested", requested));
  if (!hasEligibleField) {
    builder.addChild(moneyChild("research_budget.unfunded", -requested));
  }
  return builder.build();
}
