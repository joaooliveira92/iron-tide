//packages/combat/src/weather/default-climate-profile.ts
// B-6/ADR-0025 (DESIGN-42 §1): the SHIPPED canonical default climate profile
// `defaultClimateProfile_v1` — the campaign layer's canonical climate source for
// per-area monthly StrategicWeatherState generation until the CONTENT-track
// supplies region-specific climate-profile YAML (recorded deferral, spec §1.3).
//
// Shape follows the authored profile surface of climate.ts (ClimateProfile /
// SeasonClimateProfile) and the test-authoring pattern of
// packages/combat/test/weather/strategic-generation.test.ts. Every range is
// canonical valid (sea-state 0..9, basis-point quantities 0..10_000, wind
// direction 0..359, visibility > 0), no transition tables are declared (absent =
// explicit no-transition policy per ADR-0022 §8).
//
// The `seasonAssignment` maps EVERY campaign month id in the canonical
// simulation span (DESIGN-03 §1/§2: January 1880 .. December 1970) to one of
// four seasons by CALENDAR month — the engine keys on the full "YYYY-MM" month
// id (assertProfileComplete: `p.seasonAssignment[input.month]`), so a
// year-independent 12-month profile must enumerate the whole span to avoid a
// WEATHER_PROFILE_INCOMPLETE for e.g. a 1935 campaign. The map is computed once
// with pure integer calendar arithmetic (no wall-clock/env/locale) and frozen;
// a month outside the span fails closed with WEATHER_PROFILE_INCOMPLETE.
import { WEATHER_CLIMATE_VERSION } from "./constants.js";
import type { ClimateProfile, SeasonClimateProfile } from "./climate.js";

/** Canonical profile id of the shipped default. */
export const DEFAULT_CLIMATE_PROFILE_ID = "default" as const;

/** Four-season calendar assignment by month-of-year (Northern-Hemisphere order). */
const SEASON_BY_MONTH = {
  1: "winter",
  2: "winter",
  3: "spring",
  4: "spring",
  5: "spring",
  6: "summer",
  7: "summer",
  8: "summer",
  9: "autumn",
  10: "autumn",
  11: "autumn",
  12: "winter",
} as const;

// The canonical simulation span is 1880-01 .. 1970-12 (DESIGN-03 §1/§2). The
// campaign timeline's linear month index (year*12 + month-1) is repledicated
// here with plain integer arithmetic so this module stays dependency-free.
const SPAN_START_YEAR = 1880 as const;
const SPAN_START_MONTH = 1 as const;
const SPAN_END_YEAR = 1970 as const;
const SPAN_END_MONTH = 12 as const;

function toLinearMonth(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function monthIdOf(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function buildDefaultSeasonAssignment(): Record<string, string> {
  const assignment: Record<string, string> = {};
  const start = toLinearMonth(SPAN_START_YEAR, SPAN_START_MONTH);
  const end = toLinearMonth(SPAN_END_YEAR, SPAN_END_MONTH);
  for (let linear = start; linear <= end; linear++) {
    const year = Math.floor(linear / 12);
    const month = (linear % 12) + 1;
    assignment[monthIdOf(year, month)] = SEASON_BY_MONTH[month as keyof typeof SEASON_BY_MONTH];
  }
  return assignment;
}

function season(
  seasonId: string,
  seaStateRange: { min: number; max: number },
  windBands: readonly { bandId: string; directionDeg: number; weight: number }[],
  windSpeedRangeUmPerSec: { min: number; max: number },
  precipitationOptions: readonly {
    type: "NONE" | "RAIN" | "SNOW";
    weight: number;
    intensityRangeBp: { min: number; max: number };
  }[],
  fogMistDensityRangeBp: { min: number; max: number },
  cloudCoverRangeBp: { min: number; max: number },
  glareEligible: boolean,
  baseVisibilityRangeUm: { min: number; max: number },
): SeasonClimateProfile {
  return {
    seasonId,
    seaStateRange,
    windBands,
    windSpeedRangeUmPerSec,
    precipitationOptions,
    fogMistDensityRangeBp,
    cloudCoverRangeBp,
    daylightProfileId: "default_daylight_v1",
    glareEligible,
    baseVisibilityRangeUm,
  };
}

// Authored once, frozen: the shipped default NEVER changes for a given
// WEATHER_CLIMATE_VERSION (weather_climate_v1). A content change must ship a new
// climate version + profile (CONTENT-track), never mutate this constant.
const seasons: readonly SeasonClimateProfile[] = [
  season(
    "winter",
    { min: 4, max: 8 },
    [
      { bandId: "W", directionDeg: 270, weight: 4 },
      { bandId: "SW", directionDeg: 225, weight: 3 },
      { bandId: "NW", directionDeg: 315, weight: 2 },
    ],
    { min: 5_000_000, max: 25_000_000 },
    [
      { type: "RAIN", weight: 6, intensityRangeBp: { min: 1_000, max: 8_000 } },
      { type: "SNOW", weight: 2, intensityRangeBp: { min: 500, max: 5_000 } },
      { type: "NONE", weight: 2, intensityRangeBp: { min: 0, max: 0 } },
    ],
    { min: 200, max: 6_000 },
    { min: 4_000, max: 9_000 },
    false,
    { min: 20_000_000_000, max: 80_000_000_000 },
  ),
  season(
    "spring",
    { min: 1, max: 6 },
    [
      { bandId: "SW", directionDeg: 225, weight: 3 },
      { bandId: "W", directionDeg: 270, weight: 3 },
      { bandId: "S", directionDeg: 180, weight: 1 },
    ],
    { min: 2_000_000, max: 15_000_000 },
    [
      { type: "NONE", weight: 5, intensityRangeBp: { min: 0, max: 0 } },
      { type: "RAIN", weight: 4, intensityRangeBp: { min: 300, max: 3_500 } },
      { type: "SNOW", weight: 1, intensityRangeBp: { min: 100, max: 1_500 } },
    ],
    { min: 100, max: 4_000 },
    { min: 2_000, max: 8_000 },
    true,
    { min: 25_000_000_000, max: 90_000_000_000 },
  ),
  season(
    "summer",
    { min: 0, max: 4 },
    [
      { bandId: "SW", directionDeg: 225, weight: 3 },
      { bandId: "W", directionDeg: 270, weight: 2 },
      { bandId: "N", directionDeg: 0, weight: 1 },
    ],
    { min: 1_500_000, max: 10_000_000 },
    [
      { type: "NONE", weight: 7, intensityRangeBp: { min: 0, max: 0 } },
      { type: "RAIN", weight: 3, intensityRangeBp: { min: 500, max: 3_000 } },
    ],
    { min: 0, max: 2_500 },
    { min: 1_500, max: 6_000 },
    true,
    { min: 30_000_000_000, max: 100_000_000_000 },
  ),
  season(
    "autumn",
    { min: 1, max: 6 },
    [
      { bandId: "W", directionDeg: 270, weight: 3 },
      { bandId: "SW", directionDeg: 225, weight: 2 },
      { bandId: "NW", directionDeg: 315, weight: 2 },
    ],
    { min: 3_000_000, max: 18_000_000 },
    [
      { type: "RAIN", weight: 5, intensityRangeBp: { min: 500, max: 6_000 } },
      { type: "NONE", weight: 3, intensityRangeBp: { min: 0, max: 0 } },
      { type: "SNOW", weight: 1, intensityRangeBp: { min: 0, max: 1_000 } },
    ],
    { min: 100, max: 4_500 },
    { min: 2_500, max: 8_500 },
    true,
    { min: 20_000_000_000, max: 80_000_000_000 },
  ),
];

/**
 * The shipped canonical default climate profile (`climateProfileId "default"`,
 * climate version `weather_climate_v1`). The season assignment covers the full
 * canonical simulation span 1880-01..1970-12; every in-span month maps to a
 * season, and generation therefore never fails with WEATHER_PROFILE_INCOMPLETE
 * for an in-span campaign month (any scenario start, DESIGN-03 §1). Months
 * outside the span (none legal per DESIGN-03 §2) fail closed.
 */
export const defaultClimateProfile_v1: ClimateProfile = Object.freeze({
  climateProfileId: DEFAULT_CLIMATE_PROFILE_ID,
  climateVersion: WEATHER_CLIMATE_VERSION,
  seasonAssignment: Object.freeze(buildDefaultSeasonAssignment()),
  seasons: Object.freeze(seasons.map((s) => Object.freeze(s))),
});
