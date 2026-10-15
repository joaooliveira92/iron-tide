// AC-8 (INC-3): Development duration formula.
// Base 4 paid months, range 3-6, modifiers for complexity/technology/industry.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  computeDevelopmentDuration,
  computeMonthlyCost,
  designStreamKey,
  assertSufficientPayment,
  AIRCRAFT_DEVELOPMENT_MIN_MONTHS,
} from "../../src/aircraft/index.js";

describe("AC-8: development duration formula", () => {
  it("returns base 4 months for nominal inputs", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 2,
      technologyLevel: 2,
      industryCapacity: 2,
    });
    expect(Number(d)).toBe(4);
  });

  it("returns 4 by default when all inputs at baseline", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 1,
      technologyLevel: 1,
      industryCapacity: 1,
    });
    expect(Number(d)).toBe(4);
  });

  it("adds +1 for high complexity (roleComplexity > 3)", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 4,
      technologyLevel: 2,
      industryCapacity: 2,
    });
    expect(Number(d)).toBe(5);
  });

  it("applies -1 for high technology (technologyLevel >= 3)", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 2,
      technologyLevel: 3,
      industryCapacity: 2,
    });
    expect(Number(d)).toBe(3);
  });

  it("applies -1 for high industry (industryCapacity >= 3)", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 2,
      technologyLevel: 2,
      industryCapacity: 3,
    });
    expect(Number(d)).toBe(3);
  });

  it("clamps at MIN_MONTHS (3)", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 1,
      technologyLevel: 5,
      industryCapacity: 5,
    });
    expect(Number(d)).toBe(AIRCRAFT_DEVELOPMENT_MIN_MONTHS);
    expect(Number(d)).toBeGreaterThanOrEqual(3);
  });

  it("clamps at MAX_MONTHS (6) — but max achievable is 5 with current modifiers", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 5,
      technologyLevel: 1,
      industryCapacity: 1,
    });
    expect(Number(d)).toBe(5);
    expect(Number(d)).toBeLessThanOrEqual(6);
  });

  it("combines modifiers correctly", () => {
    const d = computeDevelopmentDuration({
      roleComplexity: 4,
      technologyLevel: 3,
      industryCapacity: 3,
    });
    expect(Number(d)).toBe(3);
  });
});

describe("monthly cost computation", () => {
  it("returns 500 * duration for duration 4", () => {
    const cost = computeMonthlyCost(SafeInt(4));
    expect(Number(cost)).toBe(2000);
  });

  it("returns 500 * duration for duration 6", () => {
    const cost = computeMonthlyCost(SafeInt(6));
    expect(Number(cost)).toBe(3000);
  });
});

describe("designStreamKey", () => {
  it("produces the correct key pattern", () => {
    const key = designStreamKey("nation_france", "FIGHTER");
    expect(key).toBe("aircraft/development/nation/nation_france/FIGHTER/proposal");
  });
});

describe("assertSufficientPayment", () => {
  it("does not throw when treasury >= monthlyCost", () => {
    expect(() => assertSufficientPayment(SafeInt(5000), SafeInt(2000))).not.toThrow();
  });

  it("throws AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT when treasury < monthlyCost", () => {
    expect(() => assertSufficientPayment(SafeInt(1000), SafeInt(2000))).toThrow(
      "AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT",
    );
  });
});
