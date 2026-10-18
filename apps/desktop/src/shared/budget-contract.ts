import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Budget-allocation contract (ADR-0060). The projection carries the player's
 * current allocation plus the engine's bounds, so the renderer never hard-codes them.
 */
export interface BudgetScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  /** Naval appropriation rate, basis points. */
  readonly appropriationRateBp: number;
  /** Monthly research budget the engine will pay next month. */
  readonly researchBudget: number;
  readonly bounds: {
    readonly appropriationRateMinBp: number;
    readonly appropriationRateMaxBp: number;
    readonly researchBudgetMin: number;
    readonly researchBudgetMax: number;
  };
  /**
   * The most research the nation may fund at each selectable appropriation rate (12% of the monthly revenue at that rate),
   * one entry per rate step from the minimum to the maximum. Computed by the engine's own calculators so the slider can
   * never offer an unpayable budget (spec #138).
   */
  readonly researchCaps: readonly { readonly rateBp: number; readonly cap: number }[];
}

/** Wire shape of `SetBudgetAllocation`; `nationId` is always the session's player slot. */
export interface SubmitBudgetAllocationPayload extends CommandEnvelope {
  readonly appropriationRateBp: number;
  readonly researchBudget: number;
}

/** The engine applies the queued envelope on the next `commitMonth`. */
export interface BudgetCommandOutcome {
  readonly commandId: string;
  readonly bodyType: "SetBudgetAllocation";
  readonly appliedOnNextTurn: true;
}
