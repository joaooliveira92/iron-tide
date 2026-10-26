import type { ExplanationTree } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";

import { explanationLabelKey, explanationModel, formatTreeValue } from "./explanation.js";
import { createPresentationFormat } from "./presentation-format/index.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const TREE: ExplanationTree = {
  formulaId: "economy_net",
  formulaVersion: "economy_v1",
  inputs: { appropriation: 4000 },
  intermediate: { outflow: 500 },
  result: 3500,
  unit: "nc",
  children: [
    {
      formulaId: "economy_net.appropriation",
      formulaVersion: "economy_v1",
      inputs: { amount: 4000 },
      intermediate: {},
      result: 4000,
      unit: "nc",
    },
    {
      formulaId: "economy_net.research",
      formulaVersion: "economy_v1",
      inputs: { amount: 300 },
      intermediate: {},
      result: -300,
      unit: "nc",
    },
  ],
};

describe("explanationModel", () => {
  it("labels nodes through the area convention and formats each value by its unit", () => {
    const model = explanationModel(TREE, "economy", "economy.economy_net.summary", FORMAT);
    expect(model.summary).toBe("Net before construction 3,500");
    expect(model.rows.map((row) => [row.key, row.label, row.valueText])).toEqual([
      ["economy_net.appropriation", "Appropriation", "4,000"],
      ["economy_net.research", "Research", "-300"],
    ]);
    expect(formatTreeValue(2000, "bp", FORMAT)).toBe("20%");
    expect(formatTreeValue(12, "months", FORMAT)).toBe("12");
  });

  it("rejects a node id that does not follow <formula>.<node>", () => {
    expect(explanationLabelKey("economy", "economy_net.appropriation")).toBe(
      "economy.economy_net.appropriation",
    );
    expect(() => explanationLabelKey("economy", "economy_net")).toThrow();
    expect(() => explanationLabelKey("economy", "economy_net.")).toThrow();
    expect(() => explanationLabelKey("economy", "a.b.c")).toThrow();
  });
});
