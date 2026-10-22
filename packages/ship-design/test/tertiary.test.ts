import { describe, expect, it } from "vite-plus/test";
import { expandTertiary, type TertiaryBalance } from "../src/index.js";

const bal: TertiaryBalance = {
  gunWeightNanoKgPerMm3: 1_500_000,
  footprintFactorPermille: 400_000,
  shellNanoKgPerMm3: 20_000,
  bearingBp: 5_000,
};
const SIX_PDR = 57_000;
const THREE_IN = 76_200;

describe("expandTertiary (#168 step 4b, ADR-0233)", () => {
  it("is nothing without a battery or with a zero count", () => {
    expect(expandTertiary(undefined, bal)).toEqual({
      guns: 0,
      weightKg: 0,
      footprintMm2: 0,
      broadsideKg: 0,
    });
    expect(expandTertiary({ caliberUm: SIX_PDR, count: 0 }, bal).weightKg).toBe(0);
  });
  it("scales weight, deck footprint and broadside linearly with the count", () => {
    const one = expandTertiary({ caliberUm: SIX_PDR, count: 1 }, bal);
    const four = expandTertiary({ caliberUm: SIX_PDR, count: 4 }, bal);
    expect(one.weightKg).toBeGreaterThan(0);
    expect(one.footprintMm2).toBeGreaterThan(0);
    expect(four.guns).toBe(4);
    expect(four.weightKg).toBe(one.weightKg * 4);
    expect(four.footprintMm2).toBe(one.footprintMm2 * 4);
    expect(four.broadsideKg).toBeGreaterThanOrEqual(one.broadsideKg * 4 - 3);
  });
  it("grows with calibre", () => {
    const small = expandTertiary({ caliberUm: SIX_PDR, count: 2 }, bal);
    const big = expandTertiary({ caliberUm: THREE_IN, count: 2 }, bal);
    expect(big.weightKg).toBeGreaterThan(small.weightKg);
    expect(big.footprintMm2).toBeGreaterThan(small.footprintMm2);
    expect(big.broadsideKg).toBeGreaterThan(small.broadsideKg);
  });
  it("matches a hand calculation for a 57 mm gun (balance-target coefficients)", () => {
    expect(expandTertiary({ caliberUm: SIX_PDR, count: 1 }, bal).weightKg).toBe(278);
    expect(expandTertiary({ caliberUm: SIX_PDR, count: 1 }, bal).footprintMm2).toBe(1_299_600);
  });
  it("only the bearing share of the guns counts toward one broadside", () => {
    const half = expandTertiary({ caliberUm: SIX_PDR, count: 4 }, bal);
    const all = expandTertiary({ caliberUm: SIX_PDR, count: 4 }, { ...bal, bearingBp: 10_000 });
    const none = expandTertiary({ caliberUm: SIX_PDR, count: 4 }, { ...bal, bearingBp: 0 });
    expect(none.broadsideKg).toBe(0);
    expect(all.broadsideKg).toBe(half.broadsideKg * 2);
  });
  it("rejects a non-integer, negative or zero calibre, and a non-integer or negative count", () => {
    for (const bad of [
      { caliberUm: 0, count: 1 },
      { caliberUm: 57.5, count: 1 },
      { caliberUm: SIX_PDR, count: -1 },
      { caliberUm: SIX_PDR, count: 1.5 },
    ])
      expect(() => expandTertiary(bad, bal)).toThrow(/tertiary/);
  });
});
