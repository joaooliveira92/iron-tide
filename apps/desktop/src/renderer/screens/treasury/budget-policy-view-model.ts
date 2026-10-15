import type { BudgetPolicyState } from "./budget-policy-state.js";

export type BudgetKnobId = "appropriation" | "research";

/** A slider the panel renders: value, bounds, step, and its formatted display. */
export interface BudgetKnob {
  readonly id: BudgetKnobId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly value: number;
  readonly display: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface BudgetPolicyViewModel {
  readonly loaded: boolean;
  readonly knobs: readonly BudgetKnob[];
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly canApply: boolean;
  readonly notice: string | null;
  readonly loadError: string | null;
}

export interface BudgetPolicyViewModelInput {
  readonly state: BudgetPolicyState;
  /** The player's effective rate, draft overlaid on the engine value. */
  readonly rate: number;
  /** The player's effective research budget, draft overlaid on the engine value. */
  readonly research: number;
  readonly loadError: string | null;
}

/** Basis points as a percentage string, e.g. 2050 -> "20.5%". */
export function formatRate(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}

/**
 * Presentation-only fold of the allocation state into what the panel renders:
 * the two sliders (value, bounds, step, display) and the apply/notice flags.
 * The engine's bounds decide the slider ranges; nothing is hard-coded here.
 */
export function buildBudgetPolicyViewModel(
  input: BudgetPolicyViewModelInput,
): BudgetPolicyViewModel {
  const { state, rate, research, loadError } = input;
  const { bounds } = state;
  const busy = state.pendingRequest !== null || state.requiresRefresh;
  const dirty = rate !== state.appropriationRateBp || research !== state.researchBudget;
  return {
    loaded: bounds.appropriationRateMaxBp > 0,
    knobs: [
      {
        id: "appropriation",
        label: "Naval appropriation",
        ariaLabel: "Naval appropriation rate",
        value: rate,
        display: formatRate(rate),
        min: bounds.appropriationRateMinBp,
        max: bounds.appropriationRateMaxBp,
        step: 50,
      },
      {
        id: "research",
        label: "Research per month",
        ariaLabel: "Research budget per month",
        value: research,
        display: research.toLocaleString(),
        min: bounds.researchBudgetMin,
        max: bounds.researchBudgetMax,
        step: 10,
      },
    ],
    dirty,
    busy,
    canApply: dirty && !busy,
    notice: state.notice,
    loadError,
  };
}
