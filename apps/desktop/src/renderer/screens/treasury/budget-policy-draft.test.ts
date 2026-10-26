import { describe, expect, it } from "vite-plus/test";

import { emptyDraft, resolveDraft, setDraftRate, setDraftResearch } from "./budget-policy-draft.js";
import type { BudgetPolicyState } from "./budget-policy-state.js";

const state: BudgetPolicyState = {
  revision: 4,
  appropriationRateBp: 2000,
  researchBudget: 60,
  bounds: {
    appropriationRateMinBp: 500,
    appropriationRateMaxBp: 5000,
    researchBudgetMin: 0,
    researchBudgetMax: 1000,
  },
  researchCaps: Array.from({ length: 91 }, (_, i) => ({
    rateBp: 500 + i * 50,
    cap: Math.floor((Math.floor((120000 * (500 + i * 50)) / 120000) * 1200) / 10000),
  })),
  commitments: null,
  pendingRequest: null,
  requiresRefresh: false,
  notice: null,
};

describe("resolveDraft", () => {
  it("falls back to the engine's committed values with an empty draft", () => {
    const resolved = resolveDraft(emptyDraft(4), state);
    expect(resolved.rate).toBe(2000);
    expect(resolved.research).toBe(60);
  });

  it("overlays only the fields the player moved", () => {
    const draft = setDraftRate(emptyDraft(4), 2100);
    const resolved = resolveDraft(draft, state);
    expect(resolved.rate).toBe(2100);
    expect(resolved.research).toBe(60);
  });

  it("discards a draft made on an older revision", () => {
    const stale = setDraftResearch({ revision: 3 }, 999);
    const resolved = resolveDraft(stale, state);
    expect(resolved.current).toEqual(emptyDraft(4));
    expect(resolved.rate).toBe(2000);
    expect(resolved.research).toBe(60);
  });

  it("keeps the other field when one slider moves", () => {
    const both = setDraftResearch(setDraftRate(emptyDraft(4), 2100), 200);
    expect(both).toEqual({ revision: 4, rate: 2100, research: 200 });
  });

  it("starts a fresh draft at the current revision when the stale one is edited", () => {
    const stale = { revision: 3, research: 999 };
    const { current } = resolveDraft(stale, state);
    expect(setDraftRate(current, 2500)).toEqual({ revision: 4, rate: 2500 });
  });
});
