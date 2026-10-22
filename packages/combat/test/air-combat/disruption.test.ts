import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeDisruption } from "../../src/air-combat/index.js";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_DISRUPTION_MIN_BP,
} from "../../src/air-combat/index.js";

describe("AC-7: Strike disruption formula", () => {
  it("12 CAP vs 24 strike → disruptionBp = 9500", () => {
    const result = computeDisruption(SafeInt(12), SafeInt(24));
    expect(Number(result)).toBe(9500);
  });

  it("equal numbers: 10 vs 10 → disruptionBp = 9000", () => {
    const result = computeDisruption(SafeInt(10), SafeInt(10));
    expect(Number(result)).toBe(9000);
  });

  it("CAP outnumbers: 20 vs 5 → disruptionBp = 6000", () => {
    const result = computeDisruption(SafeInt(20), SafeInt(5));
    expect(Number(result)).toBe(6000);
  });

  it("strike outnumbers CAP: 5 vs 30 → disruptionBp = 9834", () => {
    const result = computeDisruption(SafeInt(5), SafeInt(30));
    expect(Number(result)).toBe(9834);
  });

  it("zero CAP engaging → disruptionBp = 10000 (no disruption)", () => {
    const result = computeDisruption(SafeInt(0), SafeInt(24));
    expect(Number(result)).toBe(10000);
  });

  it("zero strike aircraft → uses max(1, 0) to avoid division by zero", () => {
    const result = computeDisruption(SafeInt(10), SafeInt(0));
    expect(Number(result)).toBe(5000);
  });

  it("very high CAP vs strike → clamped at minimum 5000", () => {
    const result = computeDisruption(SafeInt(100), SafeInt(10));
    expect(Number(result)).toBe(5000);
  });

  it("always returns value in valid range [5000, 10000]", () => {
    const cases = [
      [0, 10],
      [1, 10],
      [12, 24],
      [10, 10],
      [20, 5],
      [5, 30],
      [100, 10],
      [10, 0],
      [0, 0],
      [100, 1],
      [3, 100],
    ];
    for (const [cap, strike] of cases) {
      const result = computeDisruption(SafeInt(cap), SafeInt(strike));
      const bp = Number(result);
      expect(bp).toBeGreaterThanOrEqual(AIR_COMBAT_DISRUPTION_MIN_BP);
      expect(bp).toBeLessThanOrEqual(AIR_COMBAT_BASIS_POINTS);
    }
  });
});
