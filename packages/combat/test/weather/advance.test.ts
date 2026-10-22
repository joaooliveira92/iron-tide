import { describe, it, expect } from "vite-plus/test";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { buildTestState } from "../simulation/advance.test.js";

import {
  type WeatherEngineContext,
  type BattleWeatherComponents,
  withTacticalWeatherComponentsHash,
} from "@bluewave/combat/weather";

function noonProfile() {
  return {
    daylightProfileId: "summer_solstice_51N_v1",
    entries: [
      {
        minuteOfDay: 0,
        state: "NIGHT" as const,
        solarBearingDeg: 0,
        solarElevationDeg: -30,
      },
      {
        minuteOfDay: 390,
        state: "DAY" as const,
        solarBearingDeg: 60,
        solarElevationDeg: 20,
      },
      {
        minuteOfDay: 720,
        state: "DAY" as const,
        solarBearingDeg: 180,
        solarElevationDeg: 60,
      },
      {
        minuteOfDay: 1200,
        state: "DAY" as const,
        solarBearingDeg: 250,
        solarElevationDeg: 15,
      },
      {
        minuteOfDay: 1440,
        state: "DAY" as const,
        solarBearingDeg: 250,
        solarElevationDeg: 15,
      },
    ],
  };
}

function bareClimate() {
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
        daylightProfileId: "summer_solstice_51N_v1",
        glareEligible: false,
        baseVisibilityRangeUm: { min: 60_000_000_000, max: 60_000_000_000 },
      },
    ],
  };
}

function weatherComponents(): BattleWeatherComponents {
  return withTacticalWeatherComponentsHash({
    battleId: "battle-001",
    seaState: 3,
    windDirectionDeg: 270,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 500,
    cloudCoverBp: 5_000,
    timeOfDay: "DAY",
    solarBearingDeg: 180,
    solarElevationDeg: 60,
    glareIntensityBp: 0,
    baseVisibilityUm: 60_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
  });
}

function weatherContext(overrides: Partial<WeatherEngineContext> = {}): WeatherEngineContext {
  return {
    components: weatherComponents(),
    daylightProfile: noonProfile(),
    climateProfile: bareClimate(),
    seasonId: "all",
    battleStartMinutes: 720,
    battleSeed: "battle-seed-001",
    ...overrides,
  };
}

const BASELINE_MINUTE_HASHES = [
  "9dad9e7afe95f50db01c5f320d98ae303f621ae8b3198cd026d49b58ccc1002b",
  "7364212a3a08d71ca5ef2727c11a009011f0be0e30b2d7f3f132bbf39272a17a",
  "c2001463797927b9f5dcb9424f472c17d2fe939d3e38282c1cbe667d6d8d8b20",
] as const;

describe("AC-13: weather in minute-advance", () => {
  it("absent weather context keeps minute hashes byte-identical to the pinned B-2/B-4 baseline", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    expect(res.hashes).toEqual([...BASELINE_MINUTE_HASHES]);
    for (const r of res.results) {
      const weatherEvents = r.events.filter((e) => e.eventType.startsWith("weather_"));
      expect(weatherEvents).toHaveLength(0);
    }
  });

  it("resolveWeather runs before spotting each minute (weather events appear in ledger)", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 2,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather: weatherContext(),
    });

    for (const r of res.results) {
      const weatherEvents = r.events.filter((e) => e.eventType.startsWith("weather_"));
      expect(weatherEvents.length).toBeGreaterThanOrEqual(1);

      for (const we of weatherEvents) {
        expect(we.eventPriority).toBe(7.5);
      }
    }
  });

  it("weather events sort before spotting events in canonical order", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather: weatherContext(),
    });

    const events = res.results[0]!.events;
    const weatherIdx = events.findIndex((e) => e.eventType.startsWith("weather_"));
    const spottingIdx = events.findIndex((e) => e.eventType === "resolve_sensors_spotting");
    expect(weatherIdx).toBeGreaterThan(-1);
    expect(spottingIdx).toBeGreaterThan(-1);
    expect(weatherIdx).toBeLessThan(spottingIdx);
  });

  it("absent weather context = strict no-op (zero weather events)", () => {
    const state = buildTestState();
    const withWeather = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather: weatherContext(),
    });
    const withoutWeather = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });

    const noWeatherEvents = withoutWeather.results[0]!.events.filter((e) =>
      e.eventType.startsWith("weather_"),
    );
    expect(noWeatherEvents).toHaveLength(0);

    expect(withWeather.results[0]!.events.length).toBeGreaterThan(
      withoutWeather.results[0]!.events.length,
    );
  });

  it("same inputs produce identical results (determinism across calls)", () => {
    const state = buildTestState();
    const a = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather: weatherContext(),
    });
    const b = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather: weatherContext(),
    });

    expect(a.hashes).toEqual(b.hashes);
    for (let i = 0; i < a.results.length; i++) {
      expect(a.results[i]!.events.length).toBe(b.results[i]!.events.length);
    }
  });
});
