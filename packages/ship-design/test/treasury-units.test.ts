import { describe, expect, it } from "vite-plus/test";
import { treasuryCostUnits } from "../src/index.js";

describe("treasuryCostUnits", () => {
  it("rounds up so a ship is never priced below its cost", () => {
    expect(treasuryCostUnits(10_000_000_000, 10_000_000_000)).toBe(1);
    expect(treasuryCostUnits(10_000_000_001, 10_000_000_000)).toBe(2);
    expect(treasuryCostUnits(25_000_000_000, 10_000_000_000)).toBe(3);
  });
  it("never prices a ship at zero", () => {
    expect(treasuryCostUnits(0, 10_000_000_000)).toBe(1);
    expect(treasuryCostUnits(1, 10_000_000_000)).toBe(1);
  });
  it("is exact for costs beyond double precision", () => {
    const unit = 10_000_000_000;
    const cost = 9_007_199_254_740_000; // just under Number.MAX_SAFE_INTEGER
    expect(treasuryCostUnits(cost, unit)).toBe(
      Number((BigInt(cost) + BigInt(unit) - 1n) / BigInt(unit)),
    );
  });
  it("rejects negative, fractional and non-positive inputs", () => {
    expect(() => treasuryCostUnits(-1, 10)).toThrow(RangeError);
    expect(() => treasuryCostUnits(1.5, 10)).toThrow(RangeError);
    expect(() => treasuryCostUnits(10, 0)).toThrow(RangeError);
    expect(() => treasuryCostUnits(10, -5)).toThrow(RangeError);
    expect(() => treasuryCostUnits(Number.NaN, 10)).toThrow(RangeError);
  });
});
