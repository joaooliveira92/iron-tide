import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeTransitTimeMinutes } from "../../src/air-combat/index.js";

describe("AC-9: computeTransitTimeMinutes", () => {
  it("100000m distance, 270 mps → 7 minutes", () => {
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(270));
    expect(Number(result)).toBe(7);
  });

  it("50000m distance, 145 mps → 6 minutes", () => {
    const result = computeTransitTimeMinutes(SafeInt(50_000), SafeInt(145));
    expect(Number(result)).toBe(6);
  });

  it("0 distance → 0 minutes (already at target)", () => {
    const result = computeTransitTimeMinutes(SafeInt(0), SafeInt(270));
    expect(Number(result)).toBe(0);
  });

  it("very fast formation (500 mps) → 4 minutes", () => {
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(500));
    expect(Number(result)).toBe(4);
  });

  it("very slow formation (30 mps) → 56 minutes", () => {
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(30));
    expect(Number(result)).toBe(56);
  });

  it("large distance (1000000m, 250 mps) → 67 minutes (no overflow)", () => {
    const result = computeTransitTimeMinutes(SafeInt(1_000_000), SafeInt(250));
    expect(Number(result)).toBe(67);
  });

  it("distance not evenly divisible → ceil rounding", () => {
    const result = computeTransitTimeMinutes(SafeInt(100_001), SafeInt(250));
    expect(Number(result)).toBe(7);

    const exactResult = computeTransitTimeMinutes(SafeInt(150_000), SafeInt(250));
    expect(Number(exactResult)).toBe(10);
  });

  it("minimum speed: 1 mps → 1667 minutes", () => {
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
    const result = computeTransitTimeMinutes(SafeInt(100_000), SafeInt(0));
    expect(Number(result)).toBe(100_000);
  });
});
