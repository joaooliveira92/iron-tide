import type { BudgetPolicyState } from "./budget-policy-state.js";

/** The player's uncommitted slider values, tied to the revision they were made on. */
export interface AllocationDraft {
  readonly revision: number;
  readonly rate?: number;
  readonly research?: number;
}

export interface ResolvedDraft {
  /** The draft if it belongs to the current revision, else a fresh empty draft. */
  readonly current: AllocationDraft;
  /** Effective rate: the draft's, or the engine's when the player hasn't moved it. */
  readonly rate: number;
  /** Effective research budget: the draft's, or the engine's when untouched. */
  readonly research: number;
}

export function emptyDraft(revision: number): AllocationDraft {
  return { revision };
}

/**
 * Resolve the player's effective slider values against the engine state. A draft
 * made on an older revision is discarded (a fresh projection invalidates it), so
 * the sliders fall back to the engine's committed values.
 */
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
