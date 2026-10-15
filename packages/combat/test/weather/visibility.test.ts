//packages/combat/test/weather/visibility.test.ts
// AC-6: Visibility distance formula — exact integer rational before FLOOR;
// every multiplier explicit; missing factor → WEATHER_VISIBILITY_FORMULA_MISSING.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { computeEffectiveVisibility } from "../../src/weather/visibility.js";

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
    // 60_000_000_000 * 10_000^5 / 10_000^5 = 60_000_000_000
    expect(result.effectiveVisibilityUm).toBe(60_000_000_000);
    expect(result.rounding).toBe("floor");
    expect(result.formulaVersion).toBe("weather_visibility_v1");
  });

  it("applies a single reduced multiplier correctly", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 50_000_000_000,
      precipitationMultiplierBp: 5_000, // 0.5
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    // 50_000_000_000 * 5_000 / 10_000 = 25_000_000_000
    expect(result.effectiveVisibilityUm).toBe(25_000_000_000);
  });

  it("applies multiple reduced multipliers in sequence (floor at final division)", () => {
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 100_000_000_000,
      precipitationMultiplierBp: 5_000, // 0.5
      fogMultiplierBp: 5_000, // 0.5
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    // 100_000_000_000 * 5_000 * 5_000 / 10_000^2 = 100_000_000_000 * 25_000_000 / 100_000_000
    // = 100_000_000_000 * 0.25 = 25_000_000_000
    // Actually with BigInt: 100bn * 5000 * 5000 = 100bn * 25_000_000 = 2.5e18
    // / 10_000^2 (100_000_000) = 25_000_000_000
    expect(result.effectiveVisibilityUm).toBe(25_000_000_000);
  });

  it("floors the division result (not truncation/round)", () => {
    // 1 µm base, 1 bp for every multiplier except one at 9_999
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 1,
      precipitationMultiplierBp: 9_999, // just under 1.0
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    // 1 * 9_999 * 10_000^4 / 10_000^5 = 9_999 / 10_000 = 0.9999 -> floor = 0
    expect(result.effectiveVisibilityUm).toBe(0);

    // Edge case: 9_999 in all 5 factors
    const all9k = computeEffectiveVisibility({
      baseVisibilityUm: 1,
      precipitationMultiplierBp: 9_999,
      fogMultiplierBp: 9_999,
      daylightMultiplierBp: 9_999,
      glareMultiplierBp: 9_999,
      smokeMultiplierBp: 9_999,
    });
    // 1 * 9_999^5 / 10_000^5
    // 9_999^5 = (10_000-1)^5 ≈ 10_000^5 - 5*10_000^4 + ...
    // = 10_000^5 - 50_000_000_000_000_000_000 + ...
    // Actually compute: 9999^5 = 9996000599960005999960001? Hmm, this is complex.
    // Just check floor behavior: result should be 0 if < divisor
    // Since 9_999 < 10_000, and all 5 multipliers are < 10_000:
    // product = 9999^5 = 9995 * 10^12 (roughly)
    // divisor = 10_000^5 = 10^20
    // So product < divisor, result = 0
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

  // ---- Missing factor cases ----
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
    // Realistic worst case: max base visibility * all 5 multipliers at 10_000
    const result = computeEffectiveVisibility({
      baseVisibilityUm: 100_000_000_000,
      precipitationMultiplierBp: 10_000,
      fogMultiplierBp: 10_000,
      daylightMultiplierBp: 10_000,
      glareMultiplierBp: 10_000,
      smokeMultiplierBp: 10_000,
    });
    // Should equal the base visibility
    expect(result.effectiveVisibilityUm).toBe(100_000_000_000);
    // Verify BigInt product was safe
    expect(() => BigInt(result.productString)).not.toThrow();
  });
});
