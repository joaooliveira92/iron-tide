import { describe, expect, it } from "vite-plus/test";

import type { BudgetPolicyState } from "./budget-policy-state.js";
import {
  buildBudgetPolicyViewModel,
  formatRate,
  type BudgetPolicyViewModelInput,
} from "./budget-policy-view-model.js";

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
  pendingRequest: null,
  requiresRefresh: false,
  notice: null,
};

const input = (over: Partial<BudgetPolicyViewModelInput> = {}): BudgetPolicyViewModelInput => ({
  state,
  rate: 2000,
  research: 60,
  loadError: null,
  ...over,
});

describe("formatRate", () => {
  it("renders basis points as a one-decimal percentage", () => {
    expect(formatRate(2050)).toBe("20.5%");
    expect(formatRate(0)).toBe("0.0%");
  });
});

describe("buildBudgetPolicyViewModel", () => {
  it("describes both sliders from the engine bounds and current values", () => {
    const vm = buildBudgetPolicyViewModel(input());
    expect(vm.loaded).toBe(true);
    expect(vm.knobs.map((k) => [k.id, k.value, k.display, k.min, k.max, k.step])).toEqual([
      ["appropriation", 2000, "20.0%", 500, 5000, 50],
      ["research", 60, "60", 0, 1000, 10],
    ]);
    expect(vm.dirty).toBe(false);
    expect(vm.canApply).toBe(false);
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
