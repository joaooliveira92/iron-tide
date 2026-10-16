import { describe, expect, it } from "vite-plus/test";
import { splitLargestRemainder } from "../src/economyPhases.js";

describe("splitLargestRemainder (map D4/D5)", () => {
  it("sums exactly to the total, giving the remainder to the largest fractional parts", () => {
    // 100 over three equal weights: 33 each, one unit left over -> first index (tie broken by index).
    expect(splitLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
    // 10 over [1, 2]: ideals 3.33 and 6.67 -> [3, 7]; the larger fraction wins the leftover unit.
    expect(splitLargestRemainder(10, [1, 2])).toEqual([3, 7]);
  });

  it("is exact for arbitrary weights (the parts sum to the total)", () => {
    const parts = splitLargestRemainder(1_000, [7, 3, 5, 11]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(1_000);
  });

  it("returns zeros when there is nothing to allocate", () => {
    expect(splitLargestRemainder(0, [1, 2])).toEqual([0, 0]);
    expect(splitLargestRemainder(10, [0, 0])).toEqual([0, 0]);
  });
});
