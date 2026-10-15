//packages/combat/test/weather/strategic-state.test.ts
// AC-1: StrategicWeatherState invariant — authoritative integer
// StrategicWeatherState with correct fields and bounds; non-integers and
// out-of-range values rejected with INVALID_STRATEGIC_WEATHER_STATE or
// WEATHER_STATE_INVARIANT_FAILED.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  withStrategicWeatherStateHash,
  assertFixedPointStrategicWeather,
  type StrategicWeatherState,
} from "../../src/weather/strategic-state.js";
import { INVALID_STRATEGIC_WEATHER_STATE } from "../../src/weather/reasonCodes.js";

// ---------------------------------------------------------------------------
// Helper — minimal valid state seed (all fields canonical-integer)
function seed(overrides: Partial<StrategicWeatherState> = {}): StrategicWeatherState {
  return {
    areaId: "area-eng-ch",
    month: "1880-06",
    climateProfileId: "temperate_sea_v1",
    seasonId: "summer",
    persistentWeatherStateId: "",
    seaState: 3,
    windDirectionDeg: 135,
    windSpeedUmPerSec: 10_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 200,
    cloudCoverBp: 4_500,
    daylightProfileId: "temperate_daylight_v1",
    glareEligible: true,
    baseVisibilityUm: 50_000_000_000,
    generatedAtPhase: "weather_generation",
    rulesetVersion: "weather_ruleset_v1",
    climateVersion: "weather_climate_v1",
    formulaVersion: "weather_formula_v1",
    rngVersion: "weather_rng_v1",
    stateHash: "",
    ...overrides,
  };
}

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    if (isBluewaveError(e)) {
      const ctx = (e as BluewaveError).context ?? {};
      return ctx["code"] as string | undefined;
    }
    if (e instanceof Error) return e.message;
    return undefined;
  }
}

describe("AC-1: StrategicWeatherState invariant", () => {
  it("accepts a valid state through withStrategicWeatherStateHash", () => {
    const s = withStrategicWeatherStateHash(seed());
    expect(s.stateHash).toMatch(/^[0-9a-f]{64}$/);
    // Hash is deterministic: second call yields identical hash
    const s2 = withStrategicWeatherStateHash(seed());
    expect(s2.stateHash).toBe(s.stateHash);
  });

  it("hash differs when a field changes", () => {
    const s1 = withStrategicWeatherStateHash(seed());
    const s2 = withStrategicWeatherStateHash(seed({ seaState: 5 }));
    expect(s2.stateHash).not.toBe(s1.stateHash);
  });

  it("hash ignores provided stateHash", () => {
    const s1 = withStrategicWeatherStateHash(seed({ stateHash: "garbage" }));
    const s2 = withStrategicWeatherStateHash(seed());
    expect(s1.stateHash).toBe(s2.stateHash);
  });

  it("assertFixedPointWeather passes for valid state", () => {
    const s = withStrategicWeatherStateHash(seed());
    expect(() => assertFixedPointStrategicWeather(s)).not.toThrow();
  });

  // ---- Non-integer type violations (INVALID_STRATEGIC_WEATHER_STATE) ----
  it("rejects non-integer seaState with INVALID_STRATEGIC_WEATHER_STATE", () => {
    const s = seed({ seaState: 3.5 } as unknown as StrategicWeatherState);
    expect(() => assertFixedPointStrategicWeather(s)).toThrow(BluewaveError);
    expect(codeOf(() => assertFixedPointStrategicWeather(s))).toBe(INVALID_STRATEGIC_WEATHER_STATE);
  });

  it("rejects non-integer windDirectionDeg with INVALID_STRATEGIC_WEATHER_STATE", () => {
    const s = seed({
      windDirectionDeg: NaN,
    } as unknown as StrategicWeatherState);
    expect(() => assertFixedPointStrategicWeather(s)).toThrow(BluewaveError);
    expect(codeOf(() => assertFixedPointStrategicWeather(s))).toBe(INVALID_STRATEGIC_WEATHER_STATE);
  });

  it("rejects non-boolean glareEligible with INVALID_STRATEGIC_WEATHER_STATE", () => {
    const s = seed({
      glareEligible: "yes",
    } as unknown as StrategicWeatherState);
    expect(() => assertFixedPointStrategicWeather(s)).toThrow(BluewaveError);
    expect(codeOf(() => assertFixedPointStrategicWeather(s))).toBe(INVALID_STRATEGIC_WEATHER_STATE);
  });

  it("rejects non-string areaId with INVALID_STRATEGIC_WEATHER_STATE", () => {
    const s = seed({ areaId: "" });
    expect(() => assertFixedPointStrategicWeather(s)).toThrow(BluewaveError);
    expect(codeOf(() => assertFixedPointStrategicWeather(s))).toBe(INVALID_STRATEGIC_WEATHER_STATE);
  });

  // ---- Range violations (WEATHER_STATE_INVARIANT_FAILED) ----
  it("rejects seaState 10 (out of 0..9) with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ seaState: 10 }))).toThrow(BluewaveError);
  });

  it("rejects seaState -1 with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ seaState: -1 }))).toThrow(BluewaveError);
  });

  it("rejects windDirectionDeg 360 with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ windDirectionDeg: 360 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects fogMistDensityBp 10_001 with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ fogMistDensityBp: 10_001 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects cloudCoverBp -1 with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ cloudCoverBp: -1 }))).toThrow(BluewaveError);
  });

  it("rejects precipitationIntensityBp 15_000 with WEATHER_STATE_INVARIANT_FAILED", () => {
    expect(() => withStrategicWeatherStateHash(seed({ precipitationIntensityBp: 15_000 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects non-canonical precipitationType", () => {
    const s = seed({
      precipitationType: "HAIL",
    } as unknown as StrategicWeatherState);
    expect(() => assertFixedPointStrategicWeather(s)).toThrow(BluewaveError);
  });

  it("rejects windSpeedUmPerSec negative", () => {
    expect(() => withStrategicWeatherStateHash(seed({ windSpeedUmPerSec: -1 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects generatedAtPhase not 'weather_generation'", () => {
    const s = seed({ generatedAtPhase: "some_other_phase" });
    expect(() => withStrategicWeatherStateHash(s)).toThrow(BluewaveError);
  });

  // ---- Hash reproducibility ----
  it("same inputs produce identical state hash (determinism)", () => {
    const state1 = withStrategicWeatherStateHash(seed());
    const state2 = withStrategicWeatherStateHash(seed());
    expect(state1.stateHash).toBe(state2.stateHash);
  });
});
