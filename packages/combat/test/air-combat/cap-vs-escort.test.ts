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
    const result = computeCapAllocation(SafeInt(10), SafeInt(10));
    expect(Number(result.escortEngagingCap)).toBe(5);
    expect(Number(result.bomberEngagingCap)).toBe(5);
  });

  it("10 CAP vs 30 escort → more CAP to escort", () => {
    const result = computeCapAllocation(SafeInt(10), SafeInt(30));
    expect(Number(result.escortEngagingCap)).toBe(7);
    expect(Number(result.bomberEngagingCap)).toBe(3);
  });

  it("5 CAP vs 10 escort → moderate split", () => {
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
    expect(Number(result.escortEngagingCap)).toBe(0);
    expect(Number(result.bomberEngagingCap)).toBe(0);
  });

  it("large CAP vs small escort → most CAP to bombers", () => {
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
