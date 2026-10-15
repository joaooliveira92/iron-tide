// H1 regression + record-level hash semantics for resolveWeather:
// every returned components object must carry a stateHash equal to the
// authoritative re-computation of ITS OWN surface, and every event record's
// pre/postStateHash must be the components hash at that stage — never a stale
// pre-TOD hash (reviewer H1, MUST FIX).
import { describe, it, expect } from "vite-plus/test";
import { resolveWeather, type WeatherEngineContext } from "../../src/weather/engine.js";
import {
  withTacticalWeatherComponentsHash,
  computeTacticalWeatherComponentsHash,
  type BattleWeatherComponents,
} from "../../src/weather/components.js";
import type { ClimateProfile } from "../../src/weather/climate.js";
import type { DaylightProfile } from "../../src/weather/night-twilight.js";

// Daylight: NIGHT until minute 150, DAY from minute 150 (start battle at minute
// 150 -> currentMinute 150 -> frac 0.5 -> DAY, a genuine TOD change at minute 0).
function daylightProfile(): DaylightProfile {
  return {
    daylightProfileId: "test_daylight_v1",
    entries: [
      {
        minuteOfDay: 0,
        state: "NIGHT" as const,
        solarBearingDeg: 0,
        solarElevationDeg: -30,
      },
      {
        minuteOfDay: 300,
        state: "DAY" as const,
        solarBearingDeg: 90,
        solarElevationDeg: 20,
      },
      {
        minuteOfDay: 720,
        state: "DAY" as const,
        solarBearingDeg: 180,
        solarElevationDeg: 60,
      },
      {
        minuteOfDay: 1440,
        state: "NIGHT" as const,
        solarBearingDeg: 0,
        solarElevationDeg: -30,
      },
    ],
  };
}

function bareClimate(): ClimateProfile {
  return {
    climateProfileId: "bare_v1",
    climateVersion: "weather_climate_v1",
    seasonAssignment: { "1880-06": "all" },
    seasons: [
      {
        seasonId: "all",
        seaStateRange: { min: 3, max: 3 },
        windBands: [{ bandId: "W", directionDeg: 270, weight: 1 }],
        windSpeedRangeUmPerSec: { min: 8_000_000, max: 8_000_000 },
        precipitationOptions: [
          {
            type: "NONE" as const,
            weight: 1,
            intensityRangeBp: { min: 0, max: 0 },
          },
        ],
        fogMistDensityRangeBp: { min: 500, max: 500 },
        cloudCoverRangeBp: { min: 5_000, max: 5_000 },
        daylightProfileId: "test_daylight_v1",
        glareEligible: false,
        baseVisibilityRangeUm: { min: 60_000_000_000, max: 60_000_000_000 },
      },
    ],
  };
}

function components(overrides: Partial<BattleWeatherComponents> = {}): BattleWeatherComponents {
  return withTacticalWeatherComponentsHash({
    battleId: "battle-001",
    seaState: 3,
    windDirectionDeg: 270,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 500,
    cloudCoverBp: 5_000,
    timeOfDay: "NIGHT",
    solarBearingDeg: 0,
    solarElevationDeg: -30,
    glareIntensityBp: 0,
    baseVisibilityUm: 60_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
    ...overrides,
  });
}

function ctx(overrides: Partial<WeatherEngineContext> = {}): WeatherEngineContext {
  return {
    components: components(),
    daylightProfile: daylightProfile(),
    climateProfile: bareClimate(),
    seasonId: "all",
    battleStartMinutes: 150, // TOD changes at minute 0 (NIGHT -> DAY at frac 0.5)
    battleSeed: "seed-001",
    ...overrides,
  };
}

// Climate WITH declared transition tables + drift ranges, so a progression
// minute actually consumes per-interval draws and rehashes a changed surface.
function transitionClimate(): ClimateProfile {
  return {
    climateProfileId: "transition_sea_v1",
    climateVersion: "weather_climate_v1",
    seasonAssignment: { "1880-06": "summer" },
    seasons: [
      {
        seasonId: "summer",
        seaStateRange: { min: 1, max: 5 },
        seaStateDriftRange: { min: -1, max: 1 },
        windBands: [
          { bandId: "SW", directionDeg: 225, weight: 3 },
          { bandId: "W", directionDeg: 270, weight: 3 },
          { bandId: "NW", directionDeg: 315, weight: 2 },
        ],
        windSpeedRangeUmPerSec: { min: 2_000_000, max: 15_000_000 },
        windSpeedDriftRangeUmPerSec: { min: -1_000_000, max: 1_000_000 },
        windTransitions: {
          SW: { reachableBandIds: ["SW", "W"], weights: [5, 3] },
          W: { reachableBandIds: ["W", "SW", "NW"], weights: [5, 2, 1] },
          NW: { reachableBandIds: ["NW", "W"], weights: [5, 3] },
        },
        precipitationOptions: [
          { type: "NONE", weight: 7, intensityRangeBp: { min: 0, max: 0 } },
          {
            type: "RAIN",
            weight: 3,
            intensityRangeBp: { min: 500, max: 4_000 },
          },
        ],
        precipitationTransitions: {
          NONE: [
            {
              type: "NONE",
              weight: 6,
              intensityDriftRangeBp: { min: 0, max: 0 },
            },
            {
              type: "RAIN",
              weight: 3,
              intensityDriftRangeBp: { min: 100, max: 500 },
            },
          ],
          RAIN: [
            {
              type: "RAIN",
              weight: 5,
              intensityDriftRangeBp: { min: -200, max: 200 },
            },
            {
              type: "NONE",
              weight: 3,
              intensityDriftRangeBp: { min: 0, max: 0 },
            },
          ],
        },
        fogMistDensityRangeBp: { min: 100, max: 3_000 },
        fogDriftRangeBp: { min: -200, max: 200 },
        cloudCoverRangeBp: { min: 2_000, max: 7_000 },
        cloudDriftRangeBp: { min: -300, max: 300 },
        daylightProfileId: "test_daylight_v1",
        glareEligible: false,
        baseVisibilityRangeUm: { min: 30_000_000_000, max: 100_000_000_000 },
        visibilityDriftRangeUm: { min: -1_000_000_000, max: 1_000_000_000 },
      },
    ],
  };
}

describe("H1: resolveWeather canonical state-hash discipline", () => {
  it("non-progression minute: nextComponents.stateHash == recomputed hash", () => {
    const res = resolveWeather({ context: ctx(), battleId: "b1", minute: 1 });
    expect(res.nextComponents.stateHash).toBe(
      computeTacticalWeatherComponentsHash(res.nextComponents),
    );
  });

  it("TOD-change minute: nextComponents.stateHash == recomputed hash", () => {
    const res = resolveWeather({ context: ctx(), battleId: "b1", minute: 0 });
    expect(res.nextComponents.timeOfDay).toBe("DAY");
    expect(res.nextComponents.stateHash).toBe(
      computeTacticalWeatherComponentsHash(res.nextComponents),
    );
  });

  it("weather_time_of_day record: pre = pre-TOD hash, post = post-TOD hash", () => {
    const initial = components();
    const res = resolveWeather({ context: ctx(), battleId: "b1", minute: 0 });
    const tod = res.weatherRecords.find((r) => r.eventType === "weather_time_of_day");
    expect(tod).toBeDefined();
    // pre is the hash of the components the TOD update departed from...
    expect(tod!.preStateHash).toBe(initial.stateHash);
    // ...and post is the authoritative hash of the POST-TOD surface (which is
    // the nextComponents surface at this non-progression minute).
    expect(tod!.postStateHash).toBe(res.nextComponents.stateHash);
    expect(tod!.preStateHash).not.toBe(tod!.postStateHash);
  });

  it("weather_visibility record: pre/post are the stage components hash (never stale)", () => {
    const res = resolveWeather({ context: ctx(), battleId: "b1", minute: 0 });
    const vis = res.weatherRecords.find((r) => r.eventType === "weather_visibility");
    expect(vis).toBeDefined();
    expect(vis!.preStateHash).toBe(res.nextComponents.stateHash);
    expect(vis!.postStateHash).toBe(res.nextComponents.stateHash);
  });

  it("progression minute: nextComponents.stateHash == recomputed hash", () => {
    // Minute 30 is a progression boundary (30 % 30 === 0). With the transition
    // climate the engine consumes per-interval draws and returns the
    // post-progression surface; its stateHash must equal the authoritative
    // recompute of that final surface (H1), never a stale pre-progression hash.
    const res = resolveWeather({
      context: ctx({ climateProfile: transitionClimate(), seasonId: "summer" }),
      battleId: "b1",
      minute: 30,
    });
    expect(res.weatherRecords.some((r) => r.eventType === "weather_progression")).toBe(true);
    expect(res.nextComponents.stateHash).toBe(
      computeTacticalWeatherComponentsHash(res.nextComponents),
    );
  });
});
