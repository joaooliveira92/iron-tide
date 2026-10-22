import { describe, it, expect } from "vite-plus/test";
import {
  DIRECTOR_SCALING_TABLE,
  RADAR_SATURATION_TABLE,
  radarMediumAaMarginalMultiplierBp,
  CIWS_REDUNDANCY_TABLE,
  ciwsMarginalMultiplierBp,
  LIGHT_AA_WINDOW_DURATIONS,
  LIGHT_AA_SPEED_BANDS,
  lightAASpeedMultiplierBp,
  effectiveLightAAWindowMilliseconds,
} from "../../src/air-defense/index.js";

describe("AirDefense constants (DESIGN-45)", () => {
  describe("DIRECTOR_SCALING_TABLE (§12)", () => {
    it("should match the shipped director scaling schedule", () => {
      expect(DIRECTOR_SCALING_TABLE).toEqual([
        [0, 5_000],
        [1, 10_000],
        [2, 18_000],
        [3, 25_000],
        [4, 31_000],
      ]);
    });
  });

  describe("RADAR_SATURATION_TABLE (§14, §29.13-14)", () => {
    it("should match the canonical marginal schedule", () => {
      expect(RADAR_SATURATION_TABLE).toEqual([
        [1, 10_000],
        [2, 10_000],
        [3, 10_000],
        [4, 10_000],
        [5, 5_000],
        [6, 5_000],
        [7, 2_500],
        [8, 2_500],
        [9, 500],
      ]);
    });

    it("should report marginal multipliers by group count (9+ → 500)", () => {
      expect(radarMediumAaMarginalMultiplierBp(1)).toBe(10_000);
      expect(radarMediumAaMarginalMultiplierBp(4)).toBe(10_000);
      expect(radarMediumAaMarginalMultiplierBp(5)).toBe(5_000);
      expect(radarMediumAaMarginalMultiplierBp(6)).toBe(5_000);
      expect(radarMediumAaMarginalMultiplierBp(7)).toBe(2_500);
      expect(radarMediumAaMarginalMultiplierBp(8)).toBe(2_500);
      expect(radarMediumAaMarginalMultiplierBp(9)).toBe(500);
      expect(radarMediumAaMarginalMultiplierBp(12)).toBe(500);
      expect(radarMediumAaMarginalMultiplierBp(0)).toBe(0);
    });

    it("should produce the §14 effective group count via sum of marginal bp", () => {
      const sum = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map(radarMediumAaMarginalMultiplierBp)
        .reduce((a, b) => a + b, 0);
      expect(sum / 10_000).toBe(5.55);
    });
  });

  describe("CIWS_REDUNDANCY_TABLE (§16, §29.15-16)", () => {
    it("should match the canonical marginal schedule", () => {
      expect(CIWS_REDUNDANCY_TABLE).toEqual([
        [1, 10_000],
        [2, 10_000],
        [3, 10_000],
        [4, 10_000],
        [5, 5_000],
        [6, 5_000],
        [7, 1_500],
        [8, 1_500],
        [9, 500],
      ]);
    });

    it("should report marginal multipliers by system count (9+ → 500)", () => {
      expect(ciwsMarginalMultiplierBp(1)).toBe(10_000);
      expect(ciwsMarginalMultiplierBp(4)).toBe(10_000);
      expect(ciwsMarginalMultiplierBp(5)).toBe(5_000);
      expect(ciwsMarginalMultiplierBp(6)).toBe(5_000);
      expect(ciwsMarginalMultiplierBp(7)).toBe(1_500);
      expect(ciwsMarginalMultiplierBp(8)).toBe(1_500);
      expect(ciwsMarginalMultiplierBp(9)).toBe(500);
      expect(ciwsMarginalMultiplierBp(15)).toBe(500);
      expect(ciwsMarginalMultiplierBp(0)).toBe(0);
    });
  });

  describe("LIGHT_AA_WINDOW_DURATIONS (§9)", () => {
    it("should match the canonical base windows (torpedo = 120s)", () => {
      expect(LIGHT_AA_WINDOW_DURATIONS).toEqual({
        LEVEL: 120,
        DIVE: 60,
        TORPEDO: 120,
        SKIP: 60,
        ROCKET: 60,
      });
    });
  });

  describe("LIGHT_AA_SPEED_BANDS (§9 lines 171-176)", () => {
    it("should match the canonical knot-band schedule", () => {
      expect(LIGHT_AA_SPEED_BANDS).toEqual([
        [0, 10_000],
        [200, 7_500],
        [350, 5_000],
        [500, 2_500],
      ]);
    });

    it("should select the correct bp multiplier by knot speed", () => {
      expect(lightAASpeedMultiplierBp(0)).toBe(10_000);
      expect(lightAASpeedMultiplierBp(199)).toBe(10_000);
      expect(lightAASpeedMultiplierBp(200)).toBe(7_500);
      expect(lightAASpeedMultiplierBp(349)).toBe(7_500);
      expect(lightAASpeedMultiplierBp(350)).toBe(5_000);
      expect(lightAASpeedMultiplierBp(499)).toBe(5_000);
      expect(lightAASpeedMultiplierBp(500)).toBe(2_500);
      expect(lightAASpeedMultiplierBp(600)).toBe(2_500);
    });
  });

  describe("effectiveLightAAWindowMilliseconds (§9 line 178)", () => {
    it("should compute max(1000, floor(base * bp / 10000)) deterministically", () => {
      expect(effectiveLightAAWindowMilliseconds(120_000, 10_000)).toBe(120_000);
      expect(effectiveLightAAWindowMilliseconds(120_000, 5_000)).toBe(60_000);
      expect(effectiveLightAAWindowMilliseconds(60_000, 7_500)).toBe(45_000);
      expect(effectiveLightAAWindowMilliseconds(100, 10_000)).toBe(1_000);
    });

    it("should reject non-safe-integer inputs", () => {
      expect(() =>
        effectiveLightAAWindowMilliseconds(Number.MAX_SAFE_INTEGER + 1, 10_000),
      ).toThrow();
      expect(() =>
        effectiveLightAAWindowMilliseconds(120_000, Number.MAX_SAFE_INTEGER + 1),
      ).toThrow();
    });
  });
});
