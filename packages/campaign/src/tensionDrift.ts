import type { TensionDriftRules } from "@bluewave/content-schema";
import type { DiplomaticRelation } from "./state.js";

export const TENSION_DRIFT_STREAM_FAMILY = "diplomacy/tension_drift" as const;
export const TENSION_DRIFT_DRAW_RANGE_BP = 10_000 as const;
export const TENSION_MIN = 0 as const;
export const TENSION_MAX = 10 as const;

export type TensionDriftRuleValues = Pick<
  TensionDriftRules,
  "maxRiseProbabilityBp" | "navalRatio" | "damping" | "cooling"
>;

export interface TensionDriftPair {
  readonly relation: DiplomaticRelation["relation"];
  readonly tension: number;
  readonly frictionBp: number;
  readonly navalBudgetA: number;
  readonly navalBudgetB: number;
}

export type TensionRiseReason = "PAIR_FRICTION" | "NAVAL_RATIO";
export type TensionCoolingReason = "ALLIANCE_COOLING" | "TRADE_AGREEMENT_COOLING";

export interface TensionDriftPlan {
  readonly riseProbabilityBp: number;
  readonly riseReason?: TensionRiseReason;
  readonly coolingProbabilityBp: number;
  readonly coolingReason?: TensionCoolingReason;
}

export interface TensionDriftStep {
  readonly delta: -1 | 0 | 1;
  readonly reasonCode:
    | TensionRiseReason
    | TensionCoolingReason
    | "NO_STEP"
    | "AT_CEILING"
    | "AT_FLOOR";
}

const PARITY_BP = 10_000;
const IDLE_PLAN: TensionDriftPlan = { riseProbabilityBp: 0, coolingProbabilityBp: 0 };

export function navalRatioBp(budgetA: number, budgetB: number): number {
  const larger = Math.max(budgetA, budgetB);
  const smaller = Math.min(budgetA, budgetB);
  if (larger <= 0) return PARITY_BP;
  if (smaller <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor((larger * PARITY_BP) / smaller);
}

export function planTensionDrift(
  pair: TensionDriftPair,
  rules: TensionDriftRuleValues,
): TensionDriftPlan {
  if (pair.relation === "at_war") return IDLE_PLAN;

  const ratioPressureBp =
    pair.tension < rules.navalRatio.tensionCeiling &&
    navalRatioBp(pair.navalBudgetA, pair.navalBudgetB) >= rules.navalRatio.thresholdBp
      ? rules.navalRatio.pressureBp
      : 0;
  const dampingBp =
    pair.relation === "allied"
      ? rules.damping.alliedBp
      : pair.relation === "trade_agreement"
        ? rules.damping.tradeAgreementBp
        : 0;
  const riseProbabilityBp = Math.min(
    rules.maxRiseProbabilityBp,
    Math.max(0, pair.frictionBp + ratioPressureBp - dampingBp),
  );

  if (riseProbabilityBp > 0) {
    return {
      riseProbabilityBp,
      riseReason: ratioPressureBp > pair.frictionBp ? "NAVAL_RATIO" : "PAIR_FRICTION",
      coolingProbabilityBp: 0,
    };
  }
  if (pair.relation === "allied") {
    return {
      riseProbabilityBp: 0,
      coolingProbabilityBp: rules.cooling.alliedBp,
      coolingReason: "ALLIANCE_COOLING",
    };
  }
  if (pair.relation === "trade_agreement") {
    return {
      riseProbabilityBp: 0,
      coolingProbabilityBp: rules.cooling.tradeAgreementBp,
      coolingReason: "TRADE_AGREEMENT_COOLING",
    };
  }
  return IDLE_PLAN;
}

export function resolveTensionDriftStep(
  plan: TensionDriftPlan,
  tension: number,
  draw: number,
): TensionDriftStep {
  if (plan.riseReason !== undefined && draw < plan.riseProbabilityBp) {
    return tension >= TENSION_MAX
      ? { delta: 0, reasonCode: "AT_CEILING" }
      : { delta: 1, reasonCode: plan.riseReason };
  }
  if (
    plan.coolingReason !== undefined &&
    draw >= TENSION_DRIFT_DRAW_RANGE_BP - plan.coolingProbabilityBp
  ) {
    return tension <= TENSION_MIN
      ? { delta: 0, reasonCode: "AT_FLOOR" }
      : { delta: -1, reasonCode: plan.coolingReason };
  }
  return { delta: 0, reasonCode: "NO_STEP" };
}
