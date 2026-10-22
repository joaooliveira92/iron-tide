import type { CommandEnvelope } from "./bridge-contract.js";

export interface BudgetScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly appropriationRateBp: number;
  readonly researchBudget: number;
  readonly bounds: {
    readonly appropriationRateMinBp: number;
    readonly appropriationRateMaxBp: number;
    readonly researchBudgetMin: number;
    readonly researchBudgetMax: number;
  };
  readonly researchCaps: readonly {
    readonly rateBp: number;
    readonly cap: number;
  }[];
}

export interface SubmitBudgetAllocationPayload extends CommandEnvelope {
  readonly appropriationRateBp: number;
  readonly researchBudget: number;
}

export interface BudgetCommandOutcome {
  readonly commandId: string;
  readonly bodyType: "SetBudgetAllocation";
  readonly appliedOnNextTurn: true;
}
