import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { computeEffectiveVisibility } from "@bluewave/combat/weather";

describe("AC-6: visibility distance formula", () => {
  it("computes the effective visibility with all neutral multipliers (= base visibility)", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 60_000_000_000,
      precipitationMultiplierBp: 10_000,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(result.effectiveVisibilityUm).toBe(60_000_000_000);
    expect(result.rounding).toBe("floor");
    expect(result.formulaVersion).toBe("weather_visibility_v1");
  });

  it("applies a single reduced multiplier correctly", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 50_000_000_000,
      precipitationMultiplierBp: 5_000,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(result.effectiveVisibilityUm).toBe(25_000_000_000);
  });

  it("applies multiple reduced multipliers in sequence (floor at final division)", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 100_000_000_000,
      precipitationMultiplierBp: 5_000,
      fogMultiplierBp: 5_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(result.effectiveVisibilityUm).toBe(25_000_000_000);
  });

  it("floors the division result (not truncation/round)", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 1,
      precipitationMultiplierBp: 9_999,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(result.effectiveVisibilityUm).toBe(0);

    const all9k = computeEffectiveVisibility({
      baseVisibilityUm: 1,
      precipitationMultiplierBp: 9_999,
      fogMultiplierBp: 9_999,
      daylightMultiplierBp: 9_999,
      glareMultiplierBp: 9_999,
      smokeMultiplierBp: 9_999,
    });
    expect(all9k.effectiveVisibilityUm).toBe(0);
  });

  it("returns the BigInt product string for traceability", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 60_000_000_000,
      precipitationMultiplierBp: 10_000,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(typeof result.productString).toBe("string");
    expect(BigInt(result.productString)).toBeGreaterThan(0n);
    expect(typeof result.divisorString).toBe("string");
    expect(BigInt(result.divisorString)).toBe(10_000n ** 5n);
  });

  it("throws WEATHER_VISIBILITY_FORMULA_MISSING for NaN multiplier", () => {
    expect(() =>
      computeEffectiveVisibility({
        baseVisibilityUm: 60_000_000_000,
        precipitationMultiplierBp: NaN,
        fogMultiplierBp: 10_000,
        daylightMultiplierBp: 10_000,
        glareMultiplierBp: 10_000,
        smokeMultiplierBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("throws WEATHER_VISIBILITY_FORMULA_MISSING for negative multiplier", () => {
    expect(() =>
      computeEffectiveVisibility({
        baseVisibilityUm: 60_000_000_000,
        precipitationMultiplierBp: 10_000,
        fogMultiplierBp: -1,
        daylightMultiplierBp: 10_000,
        glareMultiplierBp: 10_000,
        smokeMultiplierBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("throws WEATHER_VISIBILITY_FORMULA_MISSING for non-integer multiplier", () => {
    expect(() =>
      computeEffectiveVisibility({
        baseVisibilityUm: 60_000_000_000,
        precipitationMultiplierBp: 10_000,
        fogMultiplierBp: 10_000,
        daylightMultiplierBp: 5_000.5,
        glareMultiplierBp: 10_000,
        smokeMultiplierBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("BigInt intermediate does not overflow for realistic values", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 100_000_000_000,
      precipitationMultiplierBp: 10_000,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    expect(result.effectiveVisibilityUm).toBe(100_000_000_000);
    expect(() => BigInt(result.productString)).not.toThrow();
  });
});
