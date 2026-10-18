import type {
  BudgetCommandOutcome,
  BudgetScreenProjection,
} from "../../../shared/budget-contract.js";
import type { RequestLifecycle } from "../../lib/command-screen-workflow.js";

export interface BudgetPolicyState extends RequestLifecycle {
  readonly appropriationRateBp: number;
  readonly researchBudget: number;
  readonly bounds: BudgetScreenProjection["bounds"];
  readonly researchCaps: BudgetScreenProjection["researchCaps"];
}

export function initialBudgetPolicyState(): BudgetPolicyState {
  return {
    revision: 0,
    appropriationRateBp: 0,
    researchBudget: 0,
    bounds: {
      appropriationRateMinBp: 0,
      appropriationRateMaxBp: 0,
      researchBudgetMin: 0,
      researchBudgetMax: 0,
    },
    researchCaps: [],
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectBudgetPolicy(
  projection: BudgetScreenProjection,
): Partial<BudgetPolicyState> {
  return {
    appropriationRateBp: projection.appropriationRateBp,
    researchBudget: projection.researchBudget,
    bounds: projection.bounds,
    researchCaps: projection.researchCaps,
  };
}

/** The engine applies the allocation when the month is committed, never immediately. */
export function acceptBudgetAllocation(_value: BudgetCommandOutcome): {
  readonly patch: Partial<BudgetPolicyState>;
  readonly notice: string;
} {
  return {
    patch: {},
    notice: "Budget allocation queued. The engine applies it when you advance the month.",
  };
}
