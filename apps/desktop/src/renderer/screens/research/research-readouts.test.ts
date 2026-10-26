import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/index.js";
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
  it("reports the budget with a breakdown against the cap", () => {
    const budget = readouts().find((r) => r.id === "budget");
    expect(budget?.value).toBe("60");
    expect(budget?.breakdown?.footer).toEqual([{ label: "Headroom under the cap", value: "60" }]);
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
