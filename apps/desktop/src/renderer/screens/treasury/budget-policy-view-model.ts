import type { BudgetPolicyState } from "./budget-policy-state.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";

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
  /** The most research the chosen rate can fund (12% of the monthly appropriation at that rate). */
  readonly researchCap: number;
  /** The research slider is above the cap at the chosen rate: the engine refuses it, so Apply is off. */
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
  /** The player's effective rate, draft overlaid on the engine value. */
  readonly rate: number;
  /** The player's effective research budget, draft overlaid on the engine value. */
  readonly research: number;
  readonly loadError: string | null;
  /** The one preference-bound, currency-aware formatter (ADR-0218). */
  readonly format: PresentationFormat;
}

/** Basis points as a percentage string, e.g. 2050 -> "20.5%". */
export function formatRate(bp: number, format: PresentationFormat): string {
  return format.percent(bp, 1);
}

/** The cap at `rate`: the entry for that step, else the nearest lower one, else 0. Presentation only — the engine decides. */
export function researchCapAt(caps: BudgetPolicyState["researchCaps"], rate: number): number {
  let cap = 0;
  for (const entry of caps) if (entry.rateBp <= rate) cap = entry.cap;
  return cap;
}

/**
 * Presentation-only fold of the allocation state into what the panel renders:
 * the two sliders (value, bounds, step, display) and the apply/notice flags.
 * The engine's bounds decide the slider ranges; nothing is hard-coded here.
 */
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
