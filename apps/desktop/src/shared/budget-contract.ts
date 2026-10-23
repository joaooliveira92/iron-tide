import type { CommandEnvelope } from "./bridge-contract.js";

export type CommitmentReadiness = "ACTIVE" | "WORKING_UP" | "RESERVE" | "MOTHBALLED" | "REPAIR";

export interface FleetUpkeepGroup {
  readonly readiness: CommitmentReadiness;
  readonly ships: number;
  readonly cost: number;
  readonly multiplierBp: number;
}

export interface FleetUpkeepShip {
  readonly id: string;
  readonly name: string;
  readonly readiness: CommitmentReadiness;
  readonly cost: number;
  readonly overBase: boolean;
}

export interface FleetUpkeep {
  readonly total: number;
  readonly atWar: boolean;
  readonly warSurcharge: number;
  readonly groups: readonly FleetUpkeepGroup[];
  readonly ships: readonly FleetUpkeepShip[];
}

export interface ConstructionCommitment {
  readonly projectId: string;
  readonly className: string;
  readonly shipType: string;
  readonly status: string;
  readonly draw: number;
  readonly carryingCost: number;
  readonly foreign: boolean;
  readonly percentComplete: number;
}

export interface ConstructionCommitments {
  readonly projects: readonly ConstructionCommitment[];
  readonly drawTotal: number;
  readonly carryingTotal: number;
  readonly haltedCount: number;
}

export interface UnpaidCostsPrestige {
  readonly before: number;
  readonly after: number;
  readonly sackingThreshold: number;
}

export interface TreasuryCommitments {
  readonly fleet: FleetUpkeep;
  readonly construction: ConstructionCommitments;
  readonly unpaidCostsPrestige: UnpaidCostsPrestige | null;
}

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
  readonly commitments: TreasuryCommitments;
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
