import type { BudgetPolicyState } from "./budget-policy-state.js";

export interface AllocationDraft {
  readonly revision: number;
  readonly rate?: number;
  readonly research?: number;
}

export interface ResolvedDraft {
  readonly current: AllocationDraft;
  readonly rate: number;
  readonly research: number;
}

export function emptyDraft(revision: number): AllocationDraft {
  return { revision };
}

export function resolveDraft(draft: AllocationDraft, state: BudgetPolicyState): ResolvedDraft {
  const current = draft.revision === state.revision ? draft : emptyDraft(state.revision);
  return {
    current,
    rate: current.rate ?? state.appropriationRateBp,
    research: current.research ?? state.researchBudget,
  };
}

export function setDraftRate(draft: AllocationDraft, rate: number): AllocationDraft {
  return { ...draft, rate };
}

export function setDraftResearch(draft: AllocationDraft, research: number): AllocationDraft {
  return { ...draft, research };
}
