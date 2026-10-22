import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  withTacticalWeatherComponentsHash,
  assertFixedPointTacticalWeather,
  type BattleWeatherComponents,
} from "../../src/weather/components.js";
import {
  INVALID_TACTICAL_WEATHER_STATE,
  WEATHER_STATE_INVARIANT_FAILED,
} from "../../src/weather/reasonCodes.js";
import { TIME_OF_DAY_STATES } from "../../src/weather/constants.js";

function seed(overrides: Partial<BattleWeatherComponents> = {}): BattleWeatherComponents {
  return {
    battleId: "battle-001",
    seaState: 4,
    windDirectionDeg: 270,
    windSpeedUmPerSec: 12_000_000,
    precipitationType: "RAIN",
    precipitationIntensityBp: 3_000,
    fogMistDensityBp: 1_200,
    cloudCoverBp: 5_500,
    timeOfDay: "DAY",
    solarBearingDeg: 120,
    solarElevationDeg: 45,
    glareIntensityBp: 0,
    baseVisibilityUm: 40_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
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
    return undefined;
  }
}

describe("AC-4: twelve tactical weather components", () => {
  it("carries all 12 canonical §3 components with integer units", () => {
    const c = withTacticalWeatherComponentsHash(seed());
    expect(Number.isInteger(c.seaState)).toBe(true);
    expect(c.seaState).toBeGreaterThanOrEqual(0);
    expect(c.seaState).toBeLessThanOrEqual(9);
    expect(Number.isInteger(c.windDirectionDeg)).toBe(true);
    expect(c.windDirectionDeg).toBeGreaterThanOrEqual(0);
    expect(c.windDirectionDeg).toBeLessThanOrEqual(359);
    expect(Number.isInteger(c.windSpeedUmPerSec)).toBe(true);
    expect(c.windSpeedUmPerSec).toBeGreaterThanOrEqual(0);
    expect(["NONE", "RAIN", "SNOW"]).toContain(c.precipitationType);
    expect(Number.isInteger(c.precipitationIntensityBp)).toBe(true);
    expect(c.precipitationIntensityBp).toBeGreaterThanOrEqual(0);
    expect(c.precipitationIntensityBp).toBeLessThanOrEqual(10_000);
    expect(Number.isInteger(c.fogMistDensityBp)).toBe(true);
    expect(c.fogMistDensityBp).toBeGreaterThanOrEqual(0);
    expect(c.fogMistDensityBp).toBeLessThanOrEqual(10_000);
    expect(Number.isInteger(c.cloudCoverBp)).toBe(true);
    expect(c.cloudCoverBp).toBeGreaterThanOrEqual(0);
    expect(c.cloudCoverBp).toBeLessThanOrEqual(10_000);
    expect(TIME_OF_DAY_STATES).toContain(c.timeOfDay);
    expect(TIME_OF_DAY_STATES).toHaveLength(5);
    expect(Number.isInteger(c.solarBearingDeg)).toBe(true);
    expect(c.solarBearingDeg).toBeGreaterThanOrEqual(0);
    expect(c.solarBearingDeg).toBeLessThanOrEqual(359);
    expect(Number.isInteger(c.solarElevationDeg)).toBe(true);
    expect(c.solarElevationDeg).toBeGreaterThanOrEqual(0);
    expect(c.solarElevationDeg).toBeLessThanOrEqual(90);
    expect(Number.isInteger(c.glareIntensityBp)).toBe(true);
    expect(c.glareIntensityBp).toBeGreaterThanOrEqual(0);
    expect(c.glareIntensityBp).toBeLessThanOrEqual(10_000);
    expect(Number.isInteger(c.baseVisibilityUm)).toBe(true);
    expect(c.baseVisibilityUm).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(c.localSmokeFields)).toBe(true);
    expect(c.localSmokeFields).toHaveLength(0);
  });

  it("carries a deterministic state hash", () => {
    const c1 = withTacticalWeatherComponentsHash(seed());
    const c2 = withTacticalWeatherComponentsHash(seed());
    expect(c1.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(c1.stateHash).toBe(c2.stateHash);
  });

  it("state hash differs when a component changes", () => {
    const c1 = withTacticalWeatherComponentsHash(seed());
    const c2 = withTacticalWeatherComponentsHash(seed({ seaState: 6 }));
    expect(c2.stateHash).not.toBe(c1.stateHash);
  });

  it("state hash ignores a supplied stateHash", () => {
    const c1 = withTacticalWeatherComponentsHash(seed({ stateHash: "junk" }));
    const c2 = withTacticalWeatherComponentsHash(seed());
    expect(c1.stateHash).toBe(c2.stateHash);
  });

  it("rejects non-integer seaState with INVALID_TACTICAL_WEATHER_STATE", () => {
    const c = seed({ seaState: 4.5 } as unknown as BattleWeatherComponents);
    expect(codeOf(() => assertFixedPointTacticalWeather(c))).toBe(INVALID_TACTICAL_WEATHER_STATE);
  });

  it("rejects non-integer fogMistDensityBp with INVALID_TACTICAL_WEATHER_STATE", () => {
    const c = seed({
      fogMistDensityBp: 1_000.5,
    } as unknown as BattleWeatherComponents);
    expect(codeOf(() => assertFixedPointTacticalWeather(c))).toBe(INVALID_TACTICAL_WEATHER_STATE);
  });

  it("rejects non-integer windDirectionDeg with INVALID_TACTICAL_WEATHER_STATE", () => {
    const c = seed({
      windDirectionDeg: NaN,
    } as unknown as BattleWeatherComponents);
    expect(codeOf(() => assertFixedPointTacticalWeather(c))).toBe(INVALID_TACTICAL_WEATHER_STATE);
  });

  it("rejects non-string localSmokeFields with INVALID_TACTICAL_WEATHER_STATE", () => {
    const c = seed({
      localSmokeFields: [42],
    } as unknown as BattleWeatherComponents);
    expect(codeOf(() => assertFixedPointTacticalWeather(c))).toBe(INVALID_TACTICAL_WEATHER_STATE);
  });

  it("rejects out-of-range seaState 10", () => {
    expect(() => withTacticalWeatherComponentsHash(seed({ seaState: 10 }))).toThrow(
      WEATHER_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects out-of-range windDirectionDeg 360", () => {
    expect(() => withTacticalWeatherComponentsHash(seed({ windDirectionDeg: 360 }))).toThrow(
      WEATHER_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects out-of-range solarElevationDeg 91", () => {
    expect(() => withTacticalWeatherComponentsHash(seed({ solarElevationDeg: 91 }))).toThrow(
      WEATHER_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects out-of-range glareIntensityBp 10_001", () => {
    expect(() => withTacticalWeatherComponentsHash(seed({ glareIntensityBp: 10_001 }))).toThrow(
      WEATHER_STATE_INVARIANT_FAILED,
    );
  });

  it("rejects non-canonical timeOfDay state", () => {
    const c = seed({
      timeOfDay: "MIDNIGHT",
    } as unknown as BattleWeatherComponents);
    expect(() => assertFixedPointTacticalWeather(c)).toThrow(WEATHER_STATE_INVARIANT_FAILED);
  });

  it("assertFixedPointWeather passes for valid components", () => {
    expect(() =>
      assertFixedPointTacticalWeather(withTacticalWeatherComponentsHash(seed())),
    ).not.toThrow();
  });
});
