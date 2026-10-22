import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { defaultClimateProfile_v1, DEFAULT_CLIMATE_PROFILE_ID } from "@bluewave/combat/weather";
import { WEATHER_CLIMATE_VERSION } from "@bluewave/combat/weather";
import { generateStrategicWeather } from "@bluewave/combat/weather";
import { WEATHER_PROFILE_INCOMPLETE } from "@bluewave/combat/weather";

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
      expect(`${monthId} -> ${season}`).toBeTruthy();
      expect(seasonIds.has(season!)).toBe(true);
    }
  });

  it("seasonAssignment covers all 12 calendar months (winter/spring/summer/autumn)", () => {
    const monthsOfYear = new Set<string>();
    for (const monthId of Object.keys(defaultClimateProfile_v1.seasonAssignment)) {
      monthsOfYear.add(monthId.slice(5, 7));
    }
    expect(monthsOfYear.size).toBe(12);
  });

  it("declares ranges that are canonical-legal (sea-state 0..9, bp 0..10_000, wind 0..359, vis > 0)", () => {
    for (const season of defaultClimateProfile_v1.seasons) {
      expect(season.seaStateRange.min).toBeGreaterThanOrEqual(0);
      expect(season.seaStateRange.max).toBeLessThanOrEqual(9);
      expect(season.seaStateRange.min).toBeLessThanOrEqual(season.seaStateRange.max);
      for (const band of season.windBands) {
        expect(Number.isInteger(band.directionDeg)).toBe(true);
        expect(band.directionDeg).toBeGreaterThanOrEqual(0);
        expect(band.directionDeg).toBeLessThanOrEqual(359);
        expect(Number.isInteger(band.weight)).toBe(true);
        expect(band.weight).toBeGreaterThanOrEqual(1);
      }
      expect(season.windSpeedRangeUmPerSec.min).toBeGreaterThanOrEqual(0);
      expect(season.windSpeedRangeUmPerSec.min).toBeLessThanOrEqual(
        season.windSpeedRangeUmPerSec.max,
      );
      expect(season.precipitationOptions.length).toBeGreaterThan(0);
      for (const opt of season.precipitationOptions) {
        expect(["NONE", "RAIN", "SNOW"]).toContain(opt.type);
        expect(Number.isInteger(opt.weight)).toBe(true);
        expect(opt.weight).toBeGreaterThanOrEqual(1);
        expect(opt.intensityRangeBp.min).toBeGreaterThanOrEqual(0);
        expect(opt.intensityRangeBp.max).toBeLessThanOrEqual(10_000);
        expect(opt.intensityRangeBp.min).toBeLessThanOrEqual(opt.intensityRangeBp.max);
      }
      expect(season.fogMistDensityRangeBp.min).toBeGreaterThanOrEqual(0);
      expect(season.fogMistDensityRangeBp.max).toBeLessThanOrEqual(10_000);
      expect(season.cloudCoverRangeBp.min).toBeGreaterThanOrEqual(0);
      expect(season.cloudCoverRangeBp.max).toBeLessThanOrEqual(10_000);
      expect(season.baseVisibilityRangeUm.min).toBeGreaterThan(0);
      expect(season.baseVisibilityRangeUm.min).toBeLessThanOrEqual(
        season.baseVisibilityRangeUm.max,
      );
      expect(season.daylightProfileId.length).toBeGreaterThan(0);
      expect(season.windTransitions).toBeUndefined();
      expect(season.precipitationTransitions).toBeUndefined();
    }
  });

  it("generates a valid StrategicWeatherState for a sample of every season (no WEATHER_PROFILE_INCOMPLETE)", () => {
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
