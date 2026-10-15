// AC-4 (INC-2): CAP allocation vs escort fighters.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeCapAllocation } from "../../src/air-combat/index.js";

describe("AC-4: CAP allocation vs escort", () => {
  it("10 CAP vs 0 escort → capToEscort = 0, all CAP to bombers", () => {
    const result = computeCapAllocation(SafeInt(10), SafeInt(0));
    expect(Number(result.escortEngagingCap)).toBe(0);
    expect(Number(result.bomberEngagingCap)).toBe(10);
  });

  it("10 CAP vs 10 escort → proportional split", () => {
    // capToEscortBp = floor(10 * 10000 / 20) = 5000
    // escortEngagingCap = floor(10 * 5000 / 10000) = 5
    const result = computeCapAllocation(SafeInt(10), SafeInt(10));
    expect(Number(result.escortEngagingCap)).toBe(5);
    expect(Number(result.bomberEngagingCap)).toBe(5);
  });

  it("10 CAP vs 30 escort → more CAP to escort", () => {
    // capToEscortBp = floor(30 * 10000 / 40) = 7500
    // escortEngagingCap = floor(10 * 7500 / 10000) = 7
    const result = computeCapAllocation(SafeInt(10), SafeInt(30));
    expect(Number(result.escortEngagingCap)).toBe(7);
    expect(Number(result.bomberEngagingCap)).toBe(3);
  });

  it("5 CAP vs 10 escort → moderate split", () => {
    // capToEscortBp = floor(10 * 10000 / 15) = floor(6666.66) = 6666
    // escortEngagingCap = floor(5 * 6666 / 10000) = floor(33330/10000) = 3
    const result = computeCapAllocation(SafeInt(5), SafeInt(10));
    expect(Number(result.escortEngagingCap)).toBe(3);
    expect(Number(result.bomberEngagingCap)).toBe(2);
  });

  it("zero CAP → all values 0", () => {
    const result = computeCapAllocation(SafeInt(0), SafeInt(10));
    expect(Number(result.escortEngagingCap)).toBe(0);
    expect(Number(result.bomberEngagingCap)).toBe(0);
  });

  it("zero CAP and zero escort → all values 0", () => {
    const result = computeCapAllocation(SafeInt(0), SafeInt(0));
    expect(Number(result.escortEngagingCap)).toBe(0);
    expect(Number(result.bomberEngagingCap)).toBe(0);
  });

  it("negative CAP (treated as zero, since only SafeInt range is checked but <=0 logic applies)", () => {
    const result = computeCapAllocation(SafeInt(-1), SafeInt(10));
    // Cap <= 0 → all zero
    expect(Number(result.escortEngagingCap)).toBe(0);
    expect(Number(result.bomberEngagingCap)).toBe(0);
  });

  it("large CAP vs small escort → most CAP to bombers", () => {
    // 100 CAP vs 2 escort
    // capToEscortBp = floor(2 * 10000 / 102) = floor(196.07) = 196
    // escortEngagingCap = floor(100 * 196 / 10000) = floor(1.96) = 1
    const result = computeCapAllocation(SafeInt(100), SafeInt(2));
    expect(Number(result.escortEngagingCap)).toBe(1);
    expect(Number(result.bomberEngagingCap)).toBe(99);
  });

  it("escortEngagingCap + bomberEngagingCap equals capCount", () => {
    const cases = [
      [10, 0],
      [10, 10],
      [10, 30],
      [5, 10],
      [20, 20],
      [12, 8],
      [1, 100],
      [100, 1],
    ];
    for (const [cap, escort] of cases) {
      const result = computeCapAllocation(SafeInt(cap), SafeInt(escort));
      const total = Number(result.escortEngagingCap) + Number(result.bomberEngagingCap);
      expect(total).toBe(cap);
    }
  });
});
