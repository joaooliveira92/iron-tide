import { describe, expect, it } from "vite-plus/test";
import {
  fleetSizeLabel,
  fleetSizeReadout,
  scenarioEraDescription,
  uncertaintyValueContent,
  UNCERTAINTY_FIELDS,
} from "./rules-of-the-naval-age-content.js";

const CANONICAL_IDS_BY_FIELD = {
  researchSpeed: ["slow", "standard", "fast", "very_fast"],
  technologyVariation: ["none", "some", "considerable"],
  historicalBudget: ["standard", "historical"],
  tacticalRealism: ["standard", "realistic", "not_applicable"],
  difficulty: ["easy", "normal", "hard", "very_hard"],
} as const;

const FLEET_SIZE_IDS = ["small", "standard", "large", "very_large"] as const;

describe("rules-of-the-naval-age-content", () => {
  it("has a non-empty label and blurb for every canonical value of every uncertainty setting", () => {
    for (const field of UNCERTAINTY_FIELDS) {
      for (const valueId of CANONICAL_IDS_BY_FIELD[field]) {
        const content = uncertaintyValueContent(field, valueId);
        expect(content.label.length).toBeGreaterThan(0);
        expect(content.blurb.length).toBeGreaterThan(0);
      }
    }
  });

  it("has a qualitative readout and label for every fleet size value", () => {
    for (const valueId of FLEET_SIZE_IDS) {
      expect(fleetSizeReadout(valueId).length).toBeGreaterThan(0);
      expect(fleetSizeLabel(valueId).length).toBeGreaterThan(0);
    }
  });

  it("recommends the standard fleet size as the default", () => {
    expect(fleetSizeReadout("standard")).toMatch(/recommended default/i);
  });

  it("flags small fleets as faster turns with fewer ships", () => {
    expect(fleetSizeReadout("small")).toMatch(/faster turns/i);
  });

  it("contains no numeric ship-count ranges in any fleet-size readout", () => {
    for (const valueId of FLEET_SIZE_IDS) {
      expect(fleetSizeReadout(valueId)).not.toMatch(/\d/);
    }
  });

  it("formats a scenario's era line with its month, year and nation count", () => {
    expect(
      scenarioEraDescription({
        id: "scen_1880",
        name: "January 1880",
        startYear: 1880,
        startMonth: 1,
        participantNationIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
        playableNationIds: [],
      }),
    ).toBe("Begins January 1880 · 8 nations");
  });

  it("uses the singular when a scenario seats a single nation", () => {
    expect(
      scenarioEraDescription({
        id: "scen_solo",
        name: "Solo",
        startYear: 1900,
        startMonth: 12,
        participantNationIds: ["a"],
        playableNationIds: ["a"],
      }),
    ).toBe("Begins December 1900 · 1 nation");
  });
});
