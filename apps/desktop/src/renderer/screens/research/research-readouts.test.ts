import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { researchLoadSuccess } from "./research-screen-state.js";
import { researchReadouts } from "./research-readouts.js";
import { fixtureProjection } from "./research-test-fixtures.js";
import { buildResearchViewModel } from "./research-view-model.js";

const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

function readouts(overrides = {}) {
  const state = researchLoadSuccess(fixtureProjection(overrides));
  if (state.kind !== "loaded") throw new Error("expected loaded");
  return researchReadouts(buildResearchViewModel(state), format);
}

describe("researchReadouts", () => {
  it("reports the paid budget with requested and cap in the breakdown", () => {
    const budget = readouts().find((r) => r.id === "budget");
    expect(budget?.value).toBe("40");
    expect(budget?.breakdown?.rows).toContainEqual({ label: "Requested each month", value: "60" });
    expect(budget?.breakdown?.rows).toContainEqual({ label: "Paid each month", value: "40" });
    expect(budget?.breakdown?.footer).toEqual([{ label: "Headroom under the cap", value: "60" }]);
  });

  it("attaches the domain explanation trees to the budget readout", () => {
    const tree = {
      formulaId: "research_cap",
      formulaVersion: "research_v1",
      inputs: {},
      intermediate: {},
      result: 120,
      unit: "nc",
    };
    const budget = readouts({
      researchSpend: 40,
      budgetExplanation: tree,
      capExplanation: tree,
      floorExplanation: tree,
    }).find((r) => r.id === "budget");
    expect(budget?.explanations?.map((e) => e.summaryKey)).toEqual([
      "research.research_budget.summary",
      "research.research_cap.summary",
      "research.research_floor.summary",
    ]);
  });

  it("reports the projected output and archive progress", () => {
    const list = readouts();
    expect(list.find((r) => r.id === "output")?.value).toBe("60 pts/month");
    expect(list.find((r) => r.id === "discovered")?.value).toBe("1 / 7");
    expect(list.find((r) => r.id === "priorities")?.value).toBe("1 / 5");
  });

  it("flags low spending only when the engine does", () => {
    expect(readouts().some((r) => r.id === "floor")).toBe(false);
    expect(readouts({ lowSpending: true }).find((r) => r.id === "floor")?.tone).toBe("warn");
  });
});
