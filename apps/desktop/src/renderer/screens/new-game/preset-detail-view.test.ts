import { describe, expect, it } from "vite-plus/test";
import { presetSettingRows } from "./preset-detail-view.js";
import { PRESET_DEFINITIONS } from "./rules-of-the-naval-age-presets.js";

function bundleOf(id: string) {
  const preset = PRESET_DEFINITIONS.find((candidate) => candidate.id === id);
  if (preset === undefined) throw new Error(`no preset ${id}`);
  return preset.bundle;
}

describe("presetSettingRows", () => {
  it("lists the six engine settings in a stable order with plain-language labels", () => {
    expect(presetSettingRows(bundleOf("cadet")).map((row) => row.label)).toEqual([
      "Fleet Size",
      "Research Pace",
      "Technology Variation",
      "Historical Budget",
      "Tactical Realism",
      "Difficulty",
    ]);
  });

  it("renders the Cadet bundle's values", () => {
    expect(presetSettingRows(bundleOf("cadet")).map((row) => row.value)).toEqual([
      "Small",
      "Standard",
      "Historical",
      "Standard",
      "Standard",
      "Easy",
    ]);
  });

  it("renders the Naval Historian bundle's values", () => {
    expect(presetSettingRows(bundleOf("naval_historian")).map((row) => row.value)).toEqual([
      "Large",
      "Slow",
      "Historical",
      "Historical",
      "Realistic",
      "Hard",
    ]);
  });

  it("keys each row by the engine setting id it came from", () => {
    expect(presetSettingRows(bundleOf("alternate_history")).map((row) => row.field)).toEqual([
      "fleetSize",
      "researchSpeed",
      "technologyVariation",
      "historicalBudget",
      "tacticalRealism",
      "difficulty",
    ]);
  });
});
