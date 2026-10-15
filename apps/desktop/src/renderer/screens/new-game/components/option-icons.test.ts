import { describe, expect, it } from "vite-plus/test";
import {
  Coins,
  Crosshair,
  FlaskConical,
  Gauge,
  Hourglass,
  Shuffle,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import { UNCERTAINTY_FIELDS, type UncertaintyField } from "../rules-of-the-naval-age-content.js";
import { fleetSizeIcon, ScenarioEraIcon, uncertaintyFieldIcon } from "./option-icons.js";

const FLEET_SIZE_IDS = ["small", "standard", "large", "very_large"] as const;

const EXPECTED_FIELD_ICONS: Record<UncertaintyField, typeof FlaskConical> = {
  researchSpeed: FlaskConical,
  technologyVariation: Shuffle,
  historicalBudget: Coins,
  tacticalRealism: Crosshair,
  difficulty: Gauge,
};

describe("option-icons", () => {
  it("maps every canonical fleet size to its own scale glyph", () => {
    expect(FLEET_SIZE_IDS.map(fleetSizeIcon)).toEqual([
      SignalLow,
      SignalMedium,
      SignalHigh,
      Signal,
    ]);
  });

  it("falls back to the middle step for an unknown fleet size", () => {
    expect(fleetSizeIcon("gargantuan")).toBe(SignalMedium);
  });

  it("gives every uncertainty setting its glyph", () => {
    for (const field of UNCERTAINTY_FIELDS) {
      expect(uncertaintyFieldIcon(field)).toBe(EXPECTED_FIELD_ICONS[field]);
    }
  });

  it("gives scenarios the era glyph", () => {
    expect(ScenarioEraIcon).toBe(Hourglass);
  });
});
