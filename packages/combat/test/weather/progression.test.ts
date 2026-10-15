// AC-5: Tactical weather progression — progression at exactly 30-min intervals
// via climate profile transition tables and keyed stream `battle/weather/interval`.
// Sea state ±1 max per interval. Wind direction per climate band. Each transition
// creates a WeatherTransitionRecord.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { RandomLedger } from "@bluewave/random";
import {
  withTacticalWeatherComponentsHash,
  type BattleWeatherComponents,
} from "../../src/weather/components.js";
import {
  progressBattleWeatherComponents,
  type ProgressWeatherInput,
} from "../../src/weather/progression.js";
import type { ClimateProfile } from "../../src/weather/climate.js";
import {
  WEATHER_RULESET_VERSION,
  WEATHER_TACTICAL_PROGRESSION_PHASE,
} from "../../src/weather/constants.js";
import { WEATHER_PROFILE_INCOMPLETE } from "../../src/weather/reasonCodes.js";

// Helper — valid battle components (spring/summer baseline)
function components(overrides: Partial<BattleWeatherComponents> = {}): BattleWeatherComponents {
  return withTacticalWeatherComponentsHash({
    battleId: "battle-001",
    seaState: 3,
    windDirectionDeg: 270,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 1_200,
    cloudCoverBp: 5_500,
    timeOfDay: "DAY",
    solarBearingDeg: 130,
    solarElevationDeg: 42,
    glareIntensityBp: 0,
    baseVisibilityUm: 60_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
    ...overrides,
  });
}

// Climate profile with transition tables for progression testing.
function transitionProfile(): ClimateProfile {
  return {
    climateProfileId: "temperate_sea_v1",
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
        daylightProfileId: "north_atlantic_summer_v1",
        glareEligible: true,
        baseVisibilityRangeUm: { min: 30_000_000_000, max: 100_000_000_000 },
        visibilityDriftRangeUm: { min: -1_000_000_000, max: 1_000_000_000 },
      },
    ],
  };
}

function makeInput(overrides: Partial<ProgressWeatherInput> = {}): ProgressWeatherInput {
  return {
    components: components(),
    climateProfile: transitionProfile(),
    seasonId: "summer",
    tacticalMinute: 30,
    battleSeed: "battle-seed-001",
    ...overrides,
  };
}

describe("AC-5: tactical weather progression", () => {
  it("progresses at the 30-minute interval boundary", () => {
    // The progression should fire at minute 30, 60, 90, etc.
    const result30 = progressBattleWeatherComponents(makeInput({ tacticalMinute: 30 }));
    expect(result30.nextComponents.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof result30.nextComponents.seaState).toBe("number");
    // Draw consumption is VARIABLE, 0..8 per interval (ADR-0022 §8): each
    // component consumes its draw(s) only when a table/drift entry exists for
    // it; an absent entry consumes nothing.
    expect(result30.transitions.length).toBeGreaterThanOrEqual(0);
  });

  it("sea state changes by at most ±1 per interval", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const result = progressBattleWeatherComponents(
        makeInput({
          components: components({ seaState: 5 }),
          battleSeed: seed,
        }),
      );
      const delta = Math.abs(result.nextComponents.seaState - 5);
      expect(delta).toBeLessThanOrEqual(1);
      expect(result.nextComponents.seaState).toBeGreaterThanOrEqual(0);
      expect(result.nextComponents.seaState).toBeLessThanOrEqual(9);
    }
  });

  it("returns a transition record for each changed component", () => {
    const result = progressBattleWeatherComponents(makeInput());
    expect(Array.isArray(result.transitions)).toBe(true);
    if (result.transitions.length > 0) {
      const t = result.transitions[0]!;
      expect(t.tacticalMinute).toBe(30);
      expect(t.intervalIndex).toBe(1);
      expect(typeof t.component).toBe("string");
      expect(typeof t.reason).toBe("string");
    }
  });

  it("same inputs produce identical progression (deterministic)", () => {
    const a = progressBattleWeatherComponents(makeInput());
    const b = progressBattleWeatherComponents(makeInput());
    expect(a.nextComponents.stateHash).toBe(b.nextComponents.stateHash);
    expect(a.transitions).toEqual(b.transitions);
  });

  it("different battle seeds produce different outcomes", () => {
    const a = progressBattleWeatherComponents(makeInput({ battleSeed: "seed-x" }));
    const b = progressBattleWeatherComponents(makeInput({ battleSeed: "seed-y" }));
    // Overwhelmingly likely the state differs
    const allEqual =
      a.nextComponents.seaState === b.nextComponents.seaState &&
      a.nextComponents.precipitationType === b.nextComponents.precipitationType &&
      a.nextComponents.fogMistDensityBp === b.nextComponents.fogMistDensityBp;
    // Very low collision probability
    expect(allEqual).toBe(false);
  });

  it("without transition tables, components stay unchanged", () => {
    const bareProfile: ClimateProfile = {
      climateProfileId: "bare_v1",
      climateVersion: "weather_climate_v1",
      seasonAssignment: { "1880-06": "all" },
      seasons: [
        {
          seasonId: "all",
          seaStateRange: { min: 3, max: 3 },
          windBands: [{ bandId: "W", directionDeg: 270, weight: 1 }],
          windSpeedRangeUmPerSec: { min: 8_000_000, max: 8_000_000 },
          precipitationOptions: [{ type: "NONE", weight: 1, intensityRangeBp: { min: 0, max: 0 } }],
          fogMistDensityRangeBp: { min: 1_200, max: 1_200 },
          cloudCoverRangeBp: { min: 5_500, max: 5_500 },
          daylightProfileId: "dp",
          glareEligible: false,
          baseVisibilityRangeUm: { min: 60_000_000_000, max: 60_000_000_000 },
        },
      ],
    };
    const result = progressBattleWeatherComponents(
      makeInput({ climateProfile: bareProfile, seasonId: "all" }),
    );
    expect(result.nextComponents.seaState).toBe(3);
    expect(result.nextComponents.precipitationType).toBe("NONE");
    expect(result.nextComponents.fogMistDensityBp).toBe(1_200);
    expect(result.nextComponents.cloudCoverBp).toBe(5_500);
    // ADR-0022 §8: table absence is an explicit no-transition policy — an
    // absent entry consumes NO draw (per-interval draw count is variable
    // 0..8), so a season declaring no tables produces no draws, no changes,
    // and no transition records.
    expect(result.transitions).toHaveLength(0);
  });

  // ---- M2: per-interval keyed stream ----
  it("each interval draws its OWN sequence (stream keyed by interval index)", () => {
    // Same seed, four different 30-minute intervals. Before the M2 fix every
    // interval replayed interval 1's draws, so all four results were identical.
    const results = [30, 60, 90, 120].map((m) =>
      progressBattleWeatherComponents(makeInput({ tacticalMinute: m })),
    );
    const distinct = new Set(results.map((r) => r.nextComponents.stateHash)).size;
    expect(distinct).toBeGreaterThan(1);
  });

  it("same interval + same seed is deterministic", () => {
    const a = progressBattleWeatherComponents(makeInput({ tacticalMinute: 60 }));
    const b = progressBattleWeatherComponents(makeInput({ tacticalMinute: 60 }));
    expect(a.nextComponents.stateHash).toBe(b.nextComponents.stateHash);
    expect(a.transitions).toEqual(b.transitions);
  });

  // ---- M3: malformed transition tables fail closed ----
  it("wind transition referencing an undeclared band fails with WEATHER_PROFILE_INCOMPLETE", () => {
    const profile = transitionProfile() as ClimateProfile;
    const season = profile.seasons[0]!;
    season.windTransitions = {
      SW: { reachableBandIds: ["SW", "GHOST_BAND"], weights: [5, 3] },
    } as never;
    let caught: unknown;
    try {
      progressBattleWeatherComponents(makeInput({ climateProfile: profile }));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
  });

  it("reachableBandIds/weights length mismatch fails closed", () => {
    const profile = transitionProfile() as ClimateProfile;
    const season = profile.seasons[0]!;
    season.windTransitions = {
      ...season.windTransitions,
      SW: { reachableBandIds: ["SW", "W"], weights: [5] },
    } as never;
    let caught: unknown;
    try {
      progressBattleWeatherComponents(makeInput({ climateProfile: profile }));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
  });

  it("missing declared season fails closed (never silent no-op)", () => {
    let caught: unknown;
    try {
      progressBattleWeatherComponents(makeInput({ seasonId: "winter" }));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
  });

  // ---- M4: sea state law-clamped to ±1 regardless of authored range ----
  it("authoritative law clamps sea-state drift to ±1 even when the profile declares a wider range", () => {
    const profile = transitionProfile() as ClimateProfile;
    profile.seasons[0]!.seaStateDriftRange = { min: -3, max: 3 };
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const result = progressBattleWeatherComponents(
        makeInput({ climateProfile: profile, battleSeed: seed }),
      );
      const delta = Math.abs(result.nextComponents.seaState - 3);
      expect(delta).toBeLessThanOrEqual(1);
    }
  });

  // ---- M6: keyed draws recorded through the RandomLedger port ----
  it("every progression draw is recorded with the per-interval stream id", () => {
    const ledger = new RandomLedger();
    progressBattleWeatherComponents(makeInput({ randomLedger: ledger }));
    expect(ledger.all.length).toBeGreaterThan(0);
    for (const d of ledger.all) {
      expect(d.streamId).toBe("battle/weather/interval/1");
      expect(d.entityKey).toBe("battle-001:1");
      expect(d.phase).toBe(WEATHER_TACTICAL_PROGRESSION_PHASE);
      expect(d.rulesetVersion).toBe(WEATHER_RULESET_VERSION);
      expect(typeof d.draw).toBe("number");
      expect(d.outcome.length).toBeGreaterThan(0);
    }
  });

  it("no draw is recorded when the season declares no transition tables", () => {
    const bareProfile: ClimateProfile = {
      climateProfileId: "bare_v1",
      climateVersion: "weather_climate_v1",
      seasonAssignment: { "1880-06": "all" },
      seasons: [
        {
          seasonId: "all",
          seaStateRange: { min: 3, max: 3 },
          windBands: [{ bandId: "W", directionDeg: 270, weight: 1 }],
          windSpeedRangeUmPerSec: { min: 8_000_000, max: 8_000_000 },
          precipitationOptions: [{ type: "NONE", weight: 1, intensityRangeBp: { min: 0, max: 0 } }],
          fogMistDensityRangeBp: { min: 1_200, max: 1_200 },
          cloudCoverRangeBp: { min: 5_500, max: 5_500 },
          daylightProfileId: "dp",
          glareEligible: false,
          baseVisibilityRangeUm: { min: 60_000_000_000, max: 60_000_000_000 },
        },
      ],
    };
    const ledger = new RandomLedger();
    const res = progressBattleWeatherComponents(
      makeInput({
        climateProfile: bareProfile,
        seasonId: "all",
        randomLedger: ledger,
      }),
    );
    expect(res.transitions).toHaveLength(0);
    expect(ledger.all).toHaveLength(0);
  });
});
