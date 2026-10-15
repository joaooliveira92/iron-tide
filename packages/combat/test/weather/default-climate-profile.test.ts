//packages/combat/test/weather/default-climate-profile.test.ts
// B-6/ADR-0025: the shipped canonical default climate profile
// `defaultClimateProfile_v1` validates against the generation guard, maps all
// 12 calendar months (over the whole canonical simulation span), declares only
// canonical-legal ranges, and generates a state for any in-span campaign month
// (no WEATHER_PROFILE_INCOMPLETE).
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  defaultClimateProfile_v1,
  DEFAULT_CLIMATE_PROFILE_ID,
} from "../../src/weather/default-climate-profile.js";
import { WEATHER_CLIMATE_VERSION } from "../../src/weather/constants.js";
import { generateStrategicWeather } from "../../src/weather/climate.js";
import { WEATHER_PROFILE_INCOMPLETE } from "../../src/weather/reasonCodes.js";

// Canonical simulation span (DESIGN-03 §1/§2): 1880-01 .. 1970-12.
const SPAN_START = toLinearMonth(1880, 1);
const SPAN_END = toLinearMonth(1970, 12);
function toLinearMonth(year: number, month: number): number {
  return year * 12 + (month - 1);
}
function monthIdOf(linear: number): string {
  const year = Math.floor(linear / 12);
  const month = (linear % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

describe("defaultClimateProfile_v1 (B-6/ADR-0025)", () => {
  it("declares the canonical default id and weather_climate_v1 version", () => {
    expect(defaultClimateProfile_v1.climateProfileId).toBe(DEFAULT_CLIMATE_PROFILE_ID);
    expect(defaultClimateProfile_v1.climateProfileId).toBe("default");
    expect(defaultClimateProfile_v1.climateVersion).toBe(WEATHER_CLIMATE_VERSION);
  });

  it("assigns every calendar month of the canonical span to a declared season", () => {
    const seasonIds = new Set(defaultClimateProfile_v1.seasons.map((s) => s.seasonId));
    for (let linear = SPAN_START; linear <= SPAN_END; linear++) {
      const monthId = monthIdOf(linear);
      const season = defaultClimateProfile_v1.seasonAssignment[monthId];
      expect(season).toBeDefined();
      expect(`${monthId} -> ${season}`).toBeTruthy(); // readable failure
      expect(seasonIds.has(season!)).toBe(true);
    }
  });

  it("seasonAssignment covers all 12 calendar months (winter/spring/summer/autumn)", () => {
    // The shipped profile is 4-season; every month-of-year appears in-span.
    const monthsOfYear = new Set<string>();
    for (const monthId of Object.keys(defaultClimateProfile_v1.seasonAssignment)) {
      monthsOfYear.add(monthId.slice(5, 7));
    }
    expect(monthsOfYear.size).toBe(12);
  });

  it("declares ranges that are canonical-legal (sea-state 0..9, bp 0..10_000, wind 0..359, vis > 0)", () => {
    for (const season of defaultClimateProfile_v1.seasons) {
      // Sea state
      expect(season.seaStateRange.min).toBeGreaterThanOrEqual(0);
      expect(season.seaStateRange.max).toBeLessThanOrEqual(9);
      expect(season.seaStateRange.min).toBeLessThanOrEqual(season.seaStateRange.max);
      // Wind bands: integer direction 0..359, integer weight >= 1
      for (const band of season.windBands) {
        expect(Number.isInteger(band.directionDeg)).toBe(true);
        expect(band.directionDeg).toBeGreaterThanOrEqual(0);
        expect(band.directionDeg).toBeLessThanOrEqual(359);
        expect(Number.isInteger(band.weight)).toBe(true);
        expect(band.weight).toBeGreaterThanOrEqual(1);
      }
      // Wind speed range: non-negative, ascending
      expect(season.windSpeedRangeUmPerSec.min).toBeGreaterThanOrEqual(0);
      expect(season.windSpeedRangeUmPerSec.min).toBeLessThanOrEqual(
        season.windSpeedRangeUmPerSec.max,
      );
      // Precipitation options: canonical types, weights >= 1, bp ranges 0..10_000
      expect(season.precipitationOptions.length).toBeGreaterThan(0);
      for (const opt of season.precipitationOptions) {
        expect(["NONE", "RAIN", "SNOW"]).toContain(opt.type);
        expect(Number.isInteger(opt.weight)).toBe(true);
        expect(opt.weight).toBeGreaterThanOrEqual(1);
        expect(opt.intensityRangeBp.min).toBeGreaterThanOrEqual(0);
        expect(opt.intensityRangeBp.max).toBeLessThanOrEqual(10_000);
        expect(opt.intensityRangeBp.min).toBeLessThanOrEqual(opt.intensityRangeBp.max);
      }
      // Fog / cloud in basis points 0..10_000
      expect(season.fogMistDensityRangeBp.min).toBeGreaterThanOrEqual(0);
      expect(season.fogMistDensityRangeBp.max).toBeLessThanOrEqual(10_000);
      expect(season.cloudCoverRangeBp.min).toBeGreaterThanOrEqual(0);
      expect(season.cloudCoverRangeBp.max).toBeLessThanOrEqual(10_000);
      // Base visibility strictly positive (DESIGN-42 §5 product needs > 0)
      expect(season.baseVisibilityRangeUm.min).toBeGreaterThan(0);
      expect(season.baseVisibilityRangeUm.min).toBeLessThanOrEqual(
        season.baseVisibilityRangeUm.max,
      );
      // Non-empty string daylight profile id
      expect(season.daylightProfileId.length).toBeGreaterThan(0);
      // No transition tables declared (absent = explicit no-transition policy)
      expect(season.windTransitions).toBeUndefined();
      expect(season.precipitationTransitions).toBeUndefined();
    }
  });

  it("generates a valid StrategicWeatherState for a sample of every season (no WEATHER_PROFILE_INCOMPLETE)", () => {
    // January (winter) of 1880, April (spring), July (summer), October
    // (autumn), and December (winter) of a later year (1935-12) to prove
    // year-independence inside the span.
    for (const month of ["1880-01", "1880-04", "1880-07", "1880-10", "1935-12"]) {
      const state = generateStrategicWeather({
        areaId: "area-test",
        month,
        climateProfile: defaultClimateProfile_v1,
        campaignSeed: "default-profile-seed",
      });
      expect(state.stateHash).toMatch(/^[0-9a-f]{64}$/);
      expect(state.climateProfileId).toBe(DEFAULT_CLIMATE_PROFILE_ID);
      expect(state.climateVersion).toBe(WEATHER_CLIMATE_VERSION);
      expect(state.month).toBe(month);
    }
  });

  it("generates a state for EVERY month of a full 12-month walk (no profile-incomplete)", () => {
    for (let month = 1; month <= 12; month++) {
      const monthId = `${String(1880).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
      expect(() =>
        generateStrategicWeather({
          areaId: "area-walk",
          month: monthId,
          climateProfile: defaultClimateProfile_v1,
          campaignSeed: "walk-seed",
        }),
      ).not.toThrow();
    }
  });

  it("fails closed for a month outside the canonical span (fail-closed, no fallback)", () => {
    const call = () =>
      generateStrategicWeather({
        areaId: "area-out",
        month: "1971-01",
        climateProfile: defaultClimateProfile_v1,
        campaignSeed: "seed",
      });
    let caught: BluewaveError | undefined;
    try {
      call();
    } catch (e) {
      caught = e as BluewaveError;
    }
    expect(caught).toBeDefined();
    expect(caught!.context.code).toBe(WEATHER_PROFILE_INCOMPLETE);
  });

  it("is frozen and deterministic across constructions", () => {
    expect(Object.isFrozen(defaultClimateProfile_v1)).toBe(true);
    const a = generateStrategicWeather({
      areaId: "area-frozen",
      month: "1900-06",
      climateProfile: defaultClimateProfile_v1,
      campaignSeed: "frozen-seed",
    });
    const b = generateStrategicWeather({
      areaId: "area-frozen",
      month: "1900-06",
      climateProfile: defaultClimateProfile_v1,
      campaignSeed: "frozen-seed",
    });
    expect(a.stateHash).toBe(b.stateHash);
  });
});
