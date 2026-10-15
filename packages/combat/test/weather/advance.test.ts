//packages/combat/test/weather/advance.test.ts
// AC-13: Weather-in-minute-advance — resolveWeather runs as a pure engine stage
// before spotting each minute (step after battle init, before B-2 step 5).
// Strict no-op when no weather components change (B-2/B-3/B-4 hashes unchanged).
import { describe, it, expect } from "vite-plus/test";
import { advanceMinutes } from "../../src/simulation/engine.js";
import { buildTestState } from "../simulation/advance.test.js";

// Weather context fixture
import {
  type WeatherEngineContext,
  type BattleWeatherComponents,
  withTacticalWeatherComponentsHash,
} from "../../src/weather/index.js";

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
    battleStartMinutes: 720, // noon
    battleSeed: "battle-seed-001",
    ...overrides,
  };
}

// Pinned B-2/B-4 baseline minute hashes (3 minutes, buildTestState, a1 order).
// The B-5 weather stage MUST be a strict no-op when no weather context is
// supplied — zero events appended and minute hashes byte-identical to these
// literals. Any B-2 movement/spotting change, or a stray weather event on the
// no-context path, breaks this pin (L1).
// ADR-0007 re-pin (P-1 ticket 08, spawn heading 90/270 -> 0/180 so the spawn
// convention matches movement's directionBp). Verified heading-only: forcing the old
// 90/270 headings onto the new spawn reproduces the OLD hashes exactly. OLD -> NEW:
//   4fec82834e5434557526c71e075388880b627689084cb5866e85a25069fc693d ->
//   9dad9e7afe95f50db01c5f320d98ae303f621ae8b3198cd026d49b58ccc1002b
//   8d5a88b1bb8f43c9fe713900f8040c821b1984e11c66f13b25fedd87bac7c3d1 ->
//   7364212a3a08d71ca5ef2727c11a009011f0be0e30b2d7f3f132bbf39272a17a
//   eba05c9b89987d26e0e592c82071193c8a098b5018be7b3cd7b795bb9d3b0e49 ->
//   c2001463797927b9f5dcb9424f472c17d2fe939d3e38282c1cbe667d6d8d8b20
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
    // And zero weather events are ever emitted on the no-context path.
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

    // Check that weather events appear in the results
    for (const r of res.results) {
      const weatherEvents = r.events.filter((e) => e.eventType.startsWith("weather_"));
      expect(weatherEvents.length).toBeGreaterThanOrEqual(1);

      // Weather events have priority 7.5, between collision (7) and spotting (8)
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
    // Weather must sort before spotting
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

    // Without weather: zero weather events
    const noWeatherEvents = withoutWeather.results[0]!.events.filter((e) =>
      e.eventType.startsWith("weather_"),
    );
    expect(noWeatherEvents).toHaveLength(0);

    // Minute hashes differ because weather adds events (AC-13 strict no-op
    // means: when weather is absent, no weather events appended — the hash
    // changes only when weather IS wired). So with/without weather have
    // different hashes; without weather = B-2/B-3/B-4 baseline.
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
