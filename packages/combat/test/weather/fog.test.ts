//packages/combat/test/weather/fog.test.ts
// AC-8: Fog/mist — density→visibility multiplier bands (§25).
import { describe, it, expect } from "vite-plus/test";
import { computeFogVisibilityMultiplierBp } from "../../src/weather/fog.js";

describe("AC-8: fog/mist visibility multipliers (§25)", () => {
  it("density 0..999 → 10_000 bp (no fog effect)", () => {
    expect(computeFogVisibilityMultiplierBp(0)).toBe(10_000);
    expect(computeFogVisibilityMultiplierBp(500)).toBe(10_000);
    expect(computeFogVisibilityMultiplierBp(999)).toBe(10_000);
  });

  it("density 1_000..2_499 → 8_500 bp (light fog)", () => {
    expect(computeFogVisibilityMultiplierBp(1_000)).toBe(8_500);
    expect(computeFogVisibilityMultiplierBp(1_750)).toBe(8_500);
    expect(computeFogVisibilityMultiplierBp(2_499)).toBe(8_500);
  });

  it("density 2_500..4_999 → 6_000 bp (moderate fog)", () => {
    expect(computeFogVisibilityMultiplierBp(2_500)).toBe(6_000);
    expect(computeFogVisibilityMultiplierBp(3_000)).toBe(6_000);
    expect(computeFogVisibilityMultiplierBp(4_999)).toBe(6_000);
  });

  it("density 5_000..7_499 → 3_500 bp (heavy fog)", () => {
    expect(computeFogVisibilityMultiplierBp(5_000)).toBe(3_500);
    expect(computeFogVisibilityMultiplierBp(6_000)).toBe(3_500);
    expect(computeFogVisibilityMultiplierBp(7_499)).toBe(3_500);
  });

  it("density 7_500..10_000 → 1_500 bp (extreme fog)", () => {
    expect(computeFogVisibilityMultiplierBp(7_500)).toBe(1_500);
    expect(computeFogVisibilityMultiplierBp(8_500)).toBe(1_500);
    expect(computeFogVisibilityMultiplierBp(10_000)).toBe(1_500);
  });
});
