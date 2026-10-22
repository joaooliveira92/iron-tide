import type { BudgetPolicyState } from "./budget-policy-state.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";

export type BudgetKnobId = "appropriation" | "research";

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
  readonly researchCap: number;
  readonly researchOverCap: boolean;
  readonly knobs: readonly BudgetKnob[];
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly canApply: boolean;
  readonly notice: string | null;
  readonly loadError: string | null;
}

export interface BudgetPolicyViewModelInput {
  readonly state: BudgetPolicyState;
  readonly rate: number;
  readonly research: number;
  readonly loadError: string | null;
  readonly format: PresentationFormat;
}

export function formatRate(bp: number, format: PresentationFormat): string {
  return format.percent(bp, 1);
}

export function researchCapAt(caps: BudgetPolicyState["researchCaps"], rate: number): number {
  let cap = 0;
  for (const entry of caps) if (entry.rateBp <= rate) cap = entry.cap;
  return cap;
}

export function buildBudgetPolicyViewModel(
  input: BudgetPolicyViewModelInput,
): BudgetPolicyViewModel {
  const { state, rate, research, loadError, format } = input;
  const { bounds } = state;
  const busy = state.pendingRequest !== null || state.requiresRefresh;
  const dirty = rate !== state.appropriationRateBp || research !== state.researchBudget;
  const researchCap = researchCapAt(state.researchCaps, rate);
  const researchOverCap = state.researchCaps.length > 0 && research > researchCap;
  return {
    loaded: bounds.appropriationRateMaxBp > 0,
    researchCap,
    researchOverCap,
    knobs: [
      {
        id: "appropriation",
        label: "Naval appropriation",
        ariaLabel: "Naval appropriation rate",
        value: rate,
        display: formatRate(rate, format),
        min: bounds.appropriationRateMinBp,
        max: bounds.appropriationRateMaxBp,
        step: 50,
      },
      {
        id: "research",
        label: "Research per month",
        ariaLabel: "Research budget per month",
        value: research,
        display: format.count(research),
        min: bounds.researchBudgetMin,
        max:
          state.researchCaps.length > 0
            ? Math.min(bounds.researchBudgetMax, researchCap)
            : bounds.researchBudgetMax,
        step: 10,
      },
    ],
    dirty,
    busy,
    canApply: dirty && !busy && !researchOverCap,
    notice: researchOverCap
      ? `Research of ${format.count(research)} is above the cap of ${format.count(researchCap)} at this appropriation rate (12% of the monthly appropriation). Lower it or raise the rate.`
      : state.notice,
    loadError,
  };
}
