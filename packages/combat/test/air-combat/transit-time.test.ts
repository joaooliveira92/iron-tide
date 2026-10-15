// AC-9 (INC-4): Transit time computation for strike formations.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeTransitTimeMinutes } from "../../src/air-combat/index.js";

describe("AC-9: computeTransitTimeMinutes", () => {
  it("100000m distance, 270 mps → 7 minutes", () => {
    // 100000 / (270 * 60) = 100000 / 16200 = 6.17 → ceil = 7
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(270));
    expect(Number(result)).toBe(7);
  });

  it("50000m distance, 145 mps → 6 minutes", () => {
    // 50000 / (145 * 60) = 50000 / 8700 = 5.74 → ceil = 6
    const result = computeTransitTimeMinutes(SafeInt(50_000), SafeInt(145));
    expect(Number(result)).toBe(6);
  });

  it("0 distance → 0 minutes (already at target)", () => {
    const result = computeTransitTimeMinutes(SafeInt(0), SafeInt(270));
    expect(Number(result)).toBe(0);
  });

  it("very fast formation (500 mps) → 4 minutes", () => {
    // 100000 / (500 * 60) = 100000 / 30000 = 3.33 → ceil = 4
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(500));
    expect(Number(result)).toBe(4);
  });

  it("very slow formation (30 mps) → 56 minutes", () => {
    // 100000 / (30 * 60) = 100000 / 1800 = 55.55 → ceil = 56
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(30));
    expect(Number(result)).toBe(56);
  });

  it("large distance (1000000m, 250 mps) → 67 minutes (no overflow)", () => {
    // 1000000 / (250 * 60) = 1000000 / 15000 = 66.67 → ceil = 67
    const result = computeTransitTimeMinutes(SafeInt(1_000_000), SafeInt(250));
    expect(Number(result)).toBe(67);
  });

  it("distance not evenly divisible → ceil rounding", () => {
    // 100001 / (250 * 60) = 100001 / 15000 = 6.667 → ceil = 7
    const result = computeTransitTimeMinutes(SafeInt(100_001), SafeInt(250));
    expect(Number(result)).toBe(7);

    // Evenly divisible: 150000 / (250 * 60) = 150000 / 15000 = 10 → ceil = 10
    const exactResult = computeTransitTimeMinutes(SafeInt(150_000), SafeInt(250));
    expect(Number(exactResult)).toBe(10);
  });

  it("minimum speed: 1 mps → 1667 minutes", () => {
    // 100000 / (1 * 60) = 100000 / 60 = 1666.67 → ceil = 1667
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(1));
    expect(Number(result)).toBe(1667);
  });

  it("throws for negative distance", () => {
    expect(() => computeTransitTimeMinutes(SafeInt(-100), SafeInt(100))).toThrow();
  });

  it("throws for negative speed", () => {
    expect(() => computeTransitTimeMinutes(SafeInt(100_000), SafeInt(-10))).toThrow();
  });

  it("zero speed uses SafeInt.ONE denominator to avoid division by zero", () => {
    // distance=100000, speedPerMinute=0, denominator becomes 1
    // 100000 / 1 = 100000
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(0));
    expect(Number(result)).toBe(100_000);
  });
});
