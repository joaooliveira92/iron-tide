import { describe, it, expect } from "vite-plus/test";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { buildTestState } from "../simulation/advance.test.js";
import { canonicalEventOrder } from "@bluewave/combat/battleResolution";
import {
  withTacticalWeatherComponentsHash,
  type WeatherEngineContext,
} from "@bluewave/combat/weather";

const daylightProfile = {
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

const climate = {
  climateProfileId: "bare_v1",
  climateVersion: "weather_climate_v1",
  seasonAssignment: { "0": "s" },
  seasons: [
    {
      seasonId: "s",
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

const components = withTacticalWeatherComponentsHash({
  battleId: "ledger-order-test",
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
});

const weather: WeatherEngineContext = {
  components,
  daylightProfile,
  climateProfile: climate,
  seasonId: "s",
  battleStartMinutes: 0,
  battleSeed: "ledger-test-seed",
};

describe("AC-12: weather events in BattleLedger order", () => {
  it("weather events appear between collision and spotting in the canonical sort", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 6,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather,
    });

    for (const minuteResult of res.results) {
      const sorted = [...minuteResult.events].sort(canonicalEventOrder);
      expect(minuteResult.events).toEqual(sorted);

      const events = sorted;
      for (let i = 0; i < events.length - 1; i++) {
        const curr = events[i]!;
        const next = events[i + 1]!;
        if (curr.minute === next.minute && curr.substep === next.substep) {
          if (curr.eventPriority === 7 && next.eventPriority === 7.5) {
            expect(curr.eventType).not.toMatch(/^weather_/);
            expect(next.eventType).toMatch(/^weather_/);
          }
          if (curr.eventPriority === 7.5 && next.eventPriority === 8) {
            expect(curr.eventType).toMatch(/^weather_/);
          }
        }
      }
    }
  });

  it("all events are canonically ordered after concat with canonicalEventOrder", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      weather,
    });

    for (const minuteResult of res.results) {
      const sorted = [...minuteResult.events].sort(canonicalEventOrder);
      expect(minuteResult.events).toEqual(sorted);
    }
  });
});
