import { describe, expect, it } from "vite-plus/test";

import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import type { BudgetPolicyState } from "./budget-policy-state.js";
import {
  buildBudgetPolicyViewModel,
  formatRate,
  type BudgetPolicyViewModelInput,
} from "./budget-policy-view-model.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

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
  // base 120000: cap = floor(12% x floor(6000 x rate / 120000)), one entry per 50 bp step.
  researchCaps: Array.from({ length: 91 }, (_, i) => ({
    rateBp: 500 + i * 50,
    cap: Math.floor((Math.floor((120000 * (500 + i * 50)) / 120000) * 1200) / 10000),
  })),
  pendingRequest: null,
  requiresRefresh: false,
  notice: null,
};

const input = (over: Partial<BudgetPolicyViewModelInput> = {}): BudgetPolicyViewModelInput => ({
  state,
  rate: 2000,
  research: 60,
  loadError: null,
  format: FORMAT,
  ...over,
});

describe("formatRate", () => {
  it("renders basis points as a one-decimal percentage", () => {
    expect(formatRate(2050, FORMAT)).toBe("20.5%");
    expect(formatRate(0, FORMAT)).toBe("0%");
  });
});

describe("buildBudgetPolicyViewModel", () => {
  it("describes both sliders from the engine bounds and current values", () => {
    const vm = buildBudgetPolicyViewModel(input());
    expect(vm.loaded).toBe(true);
    expect(vm.knobs.map((k) => [k.id, k.value, k.display, k.min, k.max, k.step])).toEqual([
      ["appropriation", 2000, "20%", 500, 5000, 50],
      // The research slider tops out at the cap for the chosen rate: 12% of 2000 = 240.
      ["research", 60, "60", 0, 240, 10],
    ]);
    expect(vm.researchCap).toBe(240);
    expect(vm.researchOverCap).toBe(false);
    expect(vm.dirty).toBe(false);
    expect(vm.canApply).toBe(false);
  });

  it("refuses to apply research above the cap at the chosen rate and says so", () => {
    // Dropping the rate to 5% (500 bp) shrinks the cap to 60: a budget of 100 is no longer payable.
    const vm = buildBudgetPolicyViewModel(input({ rate: 500, research: 100 }));
    expect(vm.researchCap).toBe(60);
    expect(vm.researchOverCap).toBe(true);
    expect(vm.canApply).toBe(false);
    expect(vm.notice).toMatch(/above the cap of 60/);
    expect(vm.knobs.find((k) => k.id === "research")?.max).toBe(60);
  });

  it("marks the allocation dirty and applyable once a slider moves off the engine value", () => {
    const vm = buildBudgetPolicyViewModel(input({ research: 200 }));
    expect(vm.dirty).toBe(true);
    expect(vm.canApply).toBe(true);
  });

  it("blocks apply while a request is in flight", () => {
    const vm = buildBudgetPolicyViewModel(
      input({
        research: 200,
        state: { ...state, pendingRequest: { kind: "submit", transportRequestId: "r1" } },
      }),
    );
    expect(vm.busy).toBe(true);
    expect(vm.canApply).toBe(false);
  });

  it("is not loaded until the engine provides real bounds", () => {
    const vm = buildBudgetPolicyViewModel(
      input({
        state: {
          ...state,
          bounds: { ...state.bounds, appropriationRateMaxBp: 0 },
        },
      }),
    );
    expect(vm.loaded).toBe(false);
  });

  it("passes the load error and notice straight through", () => {
    const vm = buildBudgetPolicyViewModel(
      input({ loadError: "boom", state: { ...state, notice: "queued" } }),
    );
    expect(vm.loadError).toBe("boom");
    expect(vm.notice).toBe("queued");
  });
});
