import type { BudgetPolicyState } from "./budget-policy-state.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";

export type BudgetKnobId = "appropriation" | "research";

export interface BudgetKnob {
  readonly id: BudgetKnobId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly value: number;
  readonly applied: number;
  readonly appliedDisplay: string;
  readonly changed: boolean;
  readonly display: string;
  readonly caption: string;
  readonly about: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface BudgetPolicyViewModel {
  readonly loaded: boolean;
  readonly researchCap: number;
  readonly researchOverCap: boolean;
  readonly rateChanged: boolean;
  readonly researchChanged: boolean;
  readonly previewResearch: number | null;
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

const COARSE_RESEARCH_STEP = 10;

export function researchStep(applied: number, draft: number, max: number): number {
  const coarse =
    max >= COARSE_RESEARCH_STEP * COARSE_RESEARCH_STEP &&
    applied % COARSE_RESEARCH_STEP === 0 &&
    draft % COARSE_RESEARCH_STEP === 0;
  return coarse ? COARSE_RESEARCH_STEP : 1;
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
  const rateChanged = rate !== state.appropriationRateBp;
  const researchChanged = research !== state.researchBudget;
  const researchMax =
    state.researchCaps.length > 0
      ? Math.min(bounds.researchBudgetMax, researchCap)
      : bounds.researchBudgetMax;
  return {
    loaded: bounds.appropriationRateMaxBp > 0,
    researchCap,
    researchOverCap,
    rateChanged,
    researchChanged,
    previewResearch: researchChanged ? Math.min(research, researchMax) : null,
    knobs: [
      {
        id: "appropriation",
        label: "Naval appropriation",
        ariaLabel: "Naval appropriation rate",
        value: rate,
        applied: state.appropriationRateBp,
        appliedDisplay: formatRate(state.appropriationRateBp, format),
        changed: rateChanged,
        display: formatRate(rate, format),
        caption: `Research ceiling at this rate: ${format.count(researchCap)} per month`,
        about:
          "The share of national revenue voted to the navy each month. It sets the monthly appropriation and the ceiling on research spending.",
        min: bounds.appropriationRateMinBp,
        max: bounds.appropriationRateMaxBp,
        step: 50,
      },
      {
        id: "research",
        label: "Research per month",
        ariaLabel: "Research budget per month",
        value: research,
        applied: state.researchBudget,
        appliedDisplay: format.count(state.researchBudget),
        changed: researchChanged,
        display: format.count(research),
        caption: `Ceiling ${format.count(researchCap)} · ${format.count(Math.max(0, researchCap - research))} unallocated`,
        about:
          "What you ask the navy to spend on research each month. It is paid only when a field can take it, and never above the ceiling set by the appropriation rate.",
        min: bounds.researchBudgetMin,
        max: researchMax,
        step: researchStep(state.researchBudget, research, researchMax),
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
