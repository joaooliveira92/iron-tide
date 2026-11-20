import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../lib/presentation-format/profile.js";
import { buildStatusStrip } from "./status-strip-state.js";
import { projection } from "./useCampaignShell.fixtures.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const changeExplanation = {
  formulaId: "unrest_change",
  formulaVersion: "unrest_v1",
  inputs: {},
  intermediate: {},
  result: 5,
  unit: "unrest",
};

describe("unrest strip model", () => {
  it("carries no explanation before the first unrest change", () => {
    const strip = buildStatusStrip({ projection, areas: [], alertsCount: 0, format: FORMAT });
    expect(strip.unrestExplanation).toBeUndefined();
    expect(strip.unrest).toEqual({ current: 0, max: 10, fraction: 0 });
  });

  it("carries the change explanation and a 0 to 10 gauge", () => {
    const strip = buildStatusStrip({
      projection: {
        ...projection,
        unrest: 5,
        unrestChange: {
          reasonCodes: ["MILITARY_SPENDING"],
          before: 3,
          after: 5,
          delta: 2,
          month: "1880-03",
          changeExplanation,
        },
      },
      areas: [],
      alertsCount: 0,
      format: FORMAT,
    });
    expect(strip.unrestExplanation).toBe(changeExplanation);
    expect(strip.unrest).toEqual({ current: 5, max: 10, fraction: 0.5 });
  });
});
