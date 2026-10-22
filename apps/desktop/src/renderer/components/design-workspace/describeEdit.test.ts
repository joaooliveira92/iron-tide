import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import { describeEdit } from "./describeEdit.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("describeEdit: fire control", () => {
  it("names the position count, singular and plural", () => {
    expect(describeEdit({ kind: "set_fire_control", positions: 1 }, String, FORMAT)).toBe(
      "Fire control: 1 position",
    );
    expect(describeEdit({ kind: "set_fire_control", positions: 3 }, String, FORMAT)).toBe(
      "Fire control: 3 positions",
    );
  });
});

describe("describeEdit: colonial service", () => {
  it("says whether the ship is fitted", () => {
    expect(describeEdit({ kind: "set_colonial_service", fitted: true }, String, FORMAT)).toBe(
      "Fit for colonial service",
    );
    expect(describeEdit({ kind: "set_colonial_service", fitted: false }, String, FORMAT)).toBe(
      "Remove the colonial-service fitting",
    );
  });
});

describe("describeEdit: armour scheme", () => {
  it("names the scheme in words", () => {
    expect(
      describeEdit(
        { kind: "set_armour_scheme", schemeId: "FLAT_DECK_ON_BELT", regions: [] },
        String,
        FORMAT,
      ),
    ).toBe("Armour scheme: flat deck on belt");
  });
});
