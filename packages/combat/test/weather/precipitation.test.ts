import { describe, it, expect } from "vite-plus/test";
import { computePrecipitationVisibilityMultiplierBp } from "../../src/weather/precipitation.js";

describe("AC-9: precipitation visibility multipliers (§26)", () => {
  it("NONE type always returns 10_000 bp regardless of intensity", () => {
    expect(computePrecipitationVisibilityMultiplierBp("NONE", 0)).toBe(10_000);
    expect(computePrecipitationVisibilityMultiplierBp("NONE", 5_000)).toBe(10_000);
    expect(computePrecipitationVisibilityMultiplierBp("NONE", 10_000)).toBe(10_000);
  });

  it("light intensity (1..2_499): RAIN → 9_000 bp", () => {
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 1)).toBe(9_000);
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 1_000)).toBe(9_000);
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 2_499)).toBe(9_000);
  });

  it("light intensity: SNOW → 9_000 bp", () => {
    expect(computePrecipitationVisibilityMultiplierBp("SNOW", 1_200)).toBe(9_000);
  });

  it("moderate intensity (2_500..4_999) → 7_500 bp", () => {
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 2_500)).toBe(7_500);
    expect(computePrecipitationVisibilityMultiplierBp("SNOW", 3_000)).toBe(7_500);
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 4_999)).toBe(7_500);
  });

  it("heavy intensity (5_000..7_499) → 5_000 bp", () => {
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 5_000)).toBe(5_000);
    expect(computePrecipitationVisibilityMultiplierBp("SNOW", 6_500)).toBe(5_000);
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 7_499)).toBe(5_000);
  });

  it("extreme intensity (7_500..10_000) → 2_500 bp", () => {
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 7_500)).toBe(2_500);
    expect(computePrecipitationVisibilityMultiplierBp("SNOW", 8_500)).toBe(2_500);
    expect(computePrecipitationVisibilityMultiplierBp("RAIN", 10_000)).toBe(2_500);
  });
});
