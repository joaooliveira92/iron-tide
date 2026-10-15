//packages/combat/test/weather/strategic-generation.test.ts
// AC-2: Strategic weather generation — monthly weather_generation phase
// generates per-area StrategicWeatherState from canonical climate profile,
// calendar month, prior persistent state, and keyed RNG stream
// `campaign/weather/<areaId>/<month>`; missing climate → WEATHER_PROFILE_INCOMPLETE.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { RandomLedger } from "@bluewave/random";
import {
  generateStrategicWeather,
  type ClimateProfile,
  type StrategicWeatherGenerationInput,
} from "../../src/weather/climate.js";
import { WEATHER_GENERATION_PHASE, WEATHER_RULESET_VERSION } from "../../src/weather/constants.js";

// ---------------------------------------------------------------------------
// Fixture climate profile — authored test surface (not production YAML;
// CONTENT-track deferred)
function temperateClimate(): ClimateProfile {
  const winterSeason = {
    seasonId: "winter",
    seaStateRange: { min: 4, max: 8 },
    windBands: [
      { bandId: "W", directionDeg: 270, weight: 4 },
      { bandId: "SW", directionDeg: 225, weight: 3 },
      { bandId: "NW", directionDeg: 315, weight: 2 },
    ],
    windSpeedRangeUmPerSec: { min: 5_000_000, max: 25_000_000 },
    precipitationOptions: [
      {
        type: "RAIN" as const,
        weight: 6,
        intensityRangeBp: { min: 1_000, max: 8_000 },
      },
      {
        type: "SNOW" as const,
        weight: 2,
        intensityRangeBp: { min: 500, max: 5_000 },
      },
      {
        type: "NONE" as const,
        weight: 2,
        intensityRangeBp: { min: 0, max: 0 },
      },
    ],
    fogMistDensityRangeBp: { min: 200, max: 6_000 },
    cloudCoverRangeBp: { min: 4_000, max: 9_000 },
    daylightProfileId: "north_atlantic_winter_v1",
    glareEligible: false,
    baseVisibilityRangeUm: { min: 20_000_000_000, max: 80_000_000_000 },
  } as const;

  const summerSeason = {
    seasonId: "summer",
    seaStateRange: { min: 1, max: 5 },
    windBands: [
      { bandId: "SW", directionDeg: 225, weight: 3 },
      { bandId: "W", directionDeg: 270, weight: 3 },
      { bandId: "N", directionDeg: 0, weight: 1 },
    ],
    windSpeedRangeUmPerSec: { min: 2_000_000, max: 15_000_000 },
    precipitationOptions: [
      {
        type: "NONE" as const,
        weight: 7,
        intensityRangeBp: { min: 0, max: 0 },
      },
      {
        type: "RAIN" as const,
        weight: 3,
        intensityRangeBp: { min: 500, max: 4_000 },
      },
    ],
    fogMistDensityRangeBp: { min: 100, max: 3_000 },
    cloudCoverRangeBp: { min: 2_000, max: 7_000 },
    daylightProfileId: "north_atlantic_summer_v1",
    glareEligible: true,
    baseVisibilityRangeUm: { min: 30_000_000_000, max: 100_000_000_000 },
  } as const;

  return {
    climateProfileId: "temperate_sea_v1",
    climateVersion: "weather_climate_v1",
    seasonAssignment: {
      "1880-01": "winter",
      "1880-02": "winter",
      "1880-06": "summer",
      "1880-07": "summer",
    },
    seasons: [winterSeason, summerSeason],
  };
}

function makeInput(
  overrides: Partial<StrategicWeatherGenerationInput> = {},
): StrategicWeatherGenerationInput {
  return {
    areaId: "area-eng-ch",
    month: "1880-06",
    climateProfile: temperateClimate(),
    campaignSeed: "test-seed-001",
    ...overrides,
  };
}

describe("AC-2: strategic weather generation", () => {
  it("generates a valid StrategicWeatherState from a climate profile + month + seed", () => {
    const state = generateStrategicWeather(makeInput());

    expect(state.areaId).toBe("area-eng-ch");
    expect(state.month).toBe("1880-06");
    expect(state.climateProfileId).toBe("temperate_sea_v1");
    expect(state.generatedAtPhase).toBe(WEATHER_GENERATION_PHASE);
    expect(state.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fields are within climate-profile declared ranges (summer)", () => {
    const state = generateStrategicWeather(makeInput());

    // Summer ranges: seaState 1..5
    expect(state.seaState).toBeGreaterThanOrEqual(1);
    expect(state.seaState).toBeLessThanOrEqual(5);
    // Wind bands: SW(225,3), W(270,3), N(0,1)
    expect([225, 270, 0]).toContain(state.windDirectionDeg);
    // Wind speed 2_000_000..15_000_000
    expect(state.windSpeedUmPerSec).toBeGreaterThanOrEqual(2_000_000);
    expect(state.windSpeedUmPerSec).toBeLessThanOrEqual(15_000_000);
    // Precipitation: NONE or RAIN
    expect(["NONE", "RAIN"]).toContain(state.precipitationType);
    // Fog 100..3_000
    expect(state.fogMistDensityBp).toBeGreaterThanOrEqual(100);
    expect(state.fogMistDensityBp).toBeLessThanOrEqual(3_000);
    // Cloud 2_000..7_000
    expect(state.cloudCoverBp).toBeGreaterThanOrEqual(2_000);
    expect(state.cloudCoverBp).toBeLessThanOrEqual(7_000);
    // Visibility 30_000_000_000..100_000_000_000
    expect(state.baseVisibilityUm).toBeGreaterThanOrEqual(30_000_000_000);
    expect(state.baseVisibilityUm).toBeLessThanOrEqual(100_000_000_000);
    // Summer: glareEligible = true
    expect(state.glareEligible).toBe(true);

    // Winter test (glare not eligible)
    const winter = generateStrategicWeather(makeInput({ month: "1880-01" }));
    expect(winter.glareEligible).toBe(false);
  });

  it("same inputs produce identical state (deterministic)", () => {
    const a = generateStrategicWeather(makeInput());
    const b = generateStrategicWeather(makeInput());
    expect(a.stateHash).toBe(b.stateHash);
    expect(a.seaState).toBe(b.seaState);
    expect(a.windDirectionDeg).toBe(b.windDirectionDeg);
    expect(a.precipitationType).toBe(b.precipitationType);
  });

  it("different areaId produces different state (keyed RNG)", () => {
    const a = generateStrategicWeather(makeInput({ areaId: "area-eng-ch" }));
    const b = generateStrategicWeather(makeInput({ areaId: "area-north-sea" }));
    // Keyed streams are domain-separated by areaId, so the states differ.
    expect(a.stateHash).not.toBe(b.stateHash);
  });

  it("different month produces different state (keyed RNG)", () => {
    const a = generateStrategicWeather(makeInput({ month: "1880-06" }));
    const b = generateStrategicWeather(makeInput({ month: "1880-07" }));
    expect(a.stateHash).not.toBe(b.stateHash);
  });

  it("missing climate profile throws WEATHER_PROFILE_INCOMPLETE", () => {
    expect(() => generateStrategicWeather(makeInput({ climateProfile: undefined }))).toThrow(
      BluewaveError,
    );
    expect(() => generateStrategicWeather(makeInput({ climateProfile: null }))).toThrow(
      BluewaveError,
    );
  });

  it("missing month in seasonAssignment throws WEATHER_PROFILE_INCOMPLETE", () => {
    const profile = temperateClimate();
    expect(() =>
      generateStrategicWeather(makeInput({ month: "1880-03", climateProfile: profile })),
    ).toThrow(BluewaveError);
  });

  it("empty wind bands (transition policy) throws WEATHER_PROFILE_INCOMPLETE", () => {
    const base = temperateClimate();
    const summer = base.seasons.find((s) => s.seasonId === "summer")!;
    const broken: ClimateProfile = {
      ...base,
      seasons: [
        {
          ...summer,
          windBands: [],
        },
      ],
    };
    // This profile's season has empty wind bands
    expect(() => generateStrategicWeather(makeInput({ climateProfile: broken }))).toThrow(
      BluewaveError,
    );
  });

  it("empty precipitation options throws WEATHER_PROFILE_INCOMPLETE", () => {
    const base = temperateClimate();
    const summer = base.seasons.find((s) => s.seasonId === "summer")!;
    const broken: ClimateProfile = {
      ...base,
      seasons: [
        {
          ...summer,
          precipitationOptions: [],
        },
      ],
    };
    expect(() => generateStrategicWeather(makeInput({ climateProfile: broken }))).toThrow(
      BluewaveError,
    );
  });

  it("seaState is always within 0..9", () => {
    for (const seed of ["seed-a", "seed-b", "seed-c", "seed-d", "seed-e"]) {
      const state = generateStrategicWeather(makeInput({ campaignSeed: seed }));
      expect(state.seaState).toBeGreaterThanOrEqual(0);
      expect(state.seaState).toBeLessThanOrEqual(9);
    }
  });

  it("prior persistent state is recorded as persistentWeatherStateId", () => {
    const first = generateStrategicWeather(makeInput());
    expect(first.persistentWeatherStateId).toBe(""); // no prior

    const second = generateStrategicWeather(makeInput({ priorState: first }));
    expect(second.persistentWeatherStateId).toBe(first.stateHash);
  });

  it("recorded random decisions in RandomLedger (port pattern)", () => {
    const ledger = new RandomLedger();
    generateStrategicWeather(makeInput({ randomLedger: ledger }));

    const decisions = [...ledger.all];
    expect(decisions.length).toBeGreaterThanOrEqual(8); // 8 drawn fields
    expect(decisions.length).toBeLessThanOrEqual(9);

    // Every decision carries the correct stream id and phase
    for (const d of decisions) {
      expect(d.streamId).toBe("campaign/weather/area-eng-ch/1880-06");
      expect(d.phase).toBe(WEATHER_GENERATION_PHASE);
      expect(d.rulesetVersion).toBe(WEATHER_RULESET_VERSION);
      expect(typeof d.draw).toBe("number");
    }

    // Verify known outcomes: sea_state_* and wind_band_* first two records
    expect(decisions[0]!.outcome).toMatch(/^sea_state_\d+$/);
    expect(decisions[1]!.outcome).toMatch(/^wind_band_/);
    expect(decisions[2]!.outcome).toMatch(/^wind_speed_ums_\d+$/);
    expect(decisions[3]!.outcome).toMatch(/^precipitation_type_/);
  });
});
