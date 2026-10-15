//packages/combat/test/weather/battle-init.test.ts
// AC-3: BattleWeatherInitialization — every battle creates one immutable
// BattleWeatherInitialization from the area's committed strategic weather
// state, battle date/time, location, mission template, local-variation policy,
// battle seed, and weather policy version; same area+overlapping time uses the
// same strategic weather source; local variation only via versioned keyed
// decision (UI/autoresolve never rerolls weather).
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { RandomLedger } from "@bluewave/random";
import {
  initializeBattleWeather,
  sameStrategicWeatherSource,
  type BattleWeatherInitializationSeed,
} from "../../src/weather/battle-init.js";
import { withStrategicWeatherStateHash } from "../../src/weather/strategic-state.js";
import {
  LOCAL_VARIATION_POLICY_NONE,
  LOCAL_VARIATION_POLICY_LIGHT,
} from "../../src/weather/constants.js";
import { INVALID_BATTLE_WEATHER_INITIALIZATION } from "../../src/weather/reasonCodes.js";

// ---------------------------------------------------------------------------
function strategicState(overrides: Record<string, unknown> = {}) {
  return withStrategicWeatherStateHash({
    areaId: "area-eng-ch",
    month: "1880-06",
    climateProfileId: "temperate_sea_v1",
    seasonId: "summer",
    persistentWeatherStateId: "",
    seaState: 3,
    windDirectionDeg: 225,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 500,
    cloudCoverBp: 5_000,
    daylightProfileId: "north_atlantic_summer_v1",
    glareEligible: true,
    baseVisibilityUm: 60_000_000_000,
    generatedAtPhase: "weather_generation",
    rulesetVersion: "weather_ruleset_v1",
    climateVersion: "weather_climate_v1",
    formulaVersion: "weather_formula_v1",
    rngVersion: "weather_rng_v1",
    ...overrides,
  });
}

function makeSeed(
  overrides: Partial<BattleWeatherInitializationSeed> = {},
): BattleWeatherInitializationSeed {
  return {
    battleId: "battle-001",
    areaId: "area-eng-ch",
    strategicWeatherState: strategicState(),
    battleDate: "1880-06-15",
    battleStartTime: "04:30",
    location: { areaId: "area-eng-ch", xUm: 5_000_000_000, yUm: 2_000_000_000 },
    missionTemplateId: "template_standard_encounter_v1",
    localVariationPolicyId: LOCAL_VARIATION_POLICY_NONE,
    battleSeed: "battle-seed-abc",
    solarGeometry: {
      timeOfDay: "DAY",
      solarBearingDeg: 130,
      solarElevationDeg: 42,
    },
    ...overrides,
  };
}

describe("AC-3: BattleWeatherInitialization", () => {
  it("creates one immutable initialization from strategic weather + battle context", () => {
    const init = initializeBattleWeather(makeSeed());

    expect(init.battleId).toBe("battle-001");
    expect(init.strategicWeatherStateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(init.battleDate).toBe("1880-06-15");
    expect(init.battleStartTime).toBe("04:30");
    expect(init.missionTemplateId).toBe("template_standard_encounter_v1");
    expect(init.weatherPolicyVersion).toBe("weather_v1");
    expect(init.componentsVersion).toBe("weather_components_v1");
    expect(init.initializationHash).toMatch(/^[0-9a-f]{64}$/);
    // Immutable
    expect(Object.isFrozen(init)).toBe(true);
    expect(Object.isFrozen(init.components)).toBe(true);
    expect(Object.isFrozen(init.location)).toBe(true);
  });

  it("same inputs produce identical initialization (no UI/autoresolve reroll)", () => {
    const a = initializeBattleWeather(makeSeed());
    const b = initializeBattleWeather(makeSeed());
    expect(a.initializationHash).toBe(b.initializationHash);
    expect(a.components.stateHash).toBe(b.components.stateHash);
  });

  it("same area + overlapping tactical time uses the same strategic weather source", () => {
    // Two battles in the same area/month draw from the SAME committed strategic
    // state; the initialization records that source by hash.
    const initA = initializeBattleWeather(makeSeed({ battleId: "battle-001", battleSeed: "s1" }));
    const initB = initializeBattleWeather(makeSeed({ battleId: "battle-002", battleSeed: "s2" }));
    expect(initA.strategicWeatherStateHash).toBe(initB.strategicWeatherStateHash);
    expect(sameStrategicWeatherSource(initA, initB)).toBe(true);
  });

  it("different strategic source states are not the same source", () => {
    const initA = initializeBattleWeather(makeSeed());
    const initB = initializeBattleWeather(
      makeSeed({
        battleId: "battle-002",
        strategicWeatherState: strategicState({ seaState: 7 }),
      }),
    );
    expect(initA.strategicWeatherStateHash).not.toBe(initB.strategicWeatherStateHash);
    expect(sameStrategicWeatherSource(initA, initB)).toBe(false);
  });

  it("NONE local-variation policy copies the strategic state exactly", () => {
    const init = initializeBattleWeather(
      makeSeed({ localVariationPolicyId: LOCAL_VARIATION_POLICY_NONE }),
    );
    const c = init.components;
    expect(c.seaState).toBe(3);
    expect(c.windDirectionDeg).toBe(225);
    expect(c.windSpeedUmPerSec).toBe(8_000_000);
    expect(c.precipitationType).toBe("NONE");
    expect(c.precipitationIntensityBp).toBe(0);
    expect(c.fogMistDensityBp).toBe(500);
    expect(c.cloudCoverBp).toBe(5_000);
    expect(c.baseVisibilityUm).toBe(60_000_000_000);
    // Solar geometry carried through from resolved geometry
    expect(c.timeOfDay).toBe("DAY");
    expect(c.solarBearingDeg).toBe(130);
    expect(c.solarElevationDeg).toBe(42);
    // glare = 0: no resolved directional geometry at initialization
    expect(c.glareIntensityBp).toBe(0);
  });

  it("LIGHT local-variation policy jitters only bp fields within the +/- jitter bounds", () => {
    const init = initializeBattleWeather(
      makeSeed({ localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT }),
    );
    const c = init.components;
    // Non-jittered fields stay exactly at strategic values
    expect(c.seaState).toBe(3);
    expect(c.windDirectionDeg).toBe(225);
    expect(c.precipitationType).toBe("NONE");
    expect(c.baseVisibilityUm).toBe(60_000_000_000);
    // Jittered fields are within +/-500 bp of the strategic value (and canonical bounds)
    expect(Math.abs(c.precipitationIntensityBp - 0)).toBeLessThanOrEqual(500);
    expect(c.precipitationIntensityBp).toBeGreaterThanOrEqual(0);
    expect(c.precipitationIntensityBp).toBeLessThanOrEqual(10_000);
    expect(Math.abs(c.fogMistDensityBp - 500)).toBeLessThanOrEqual(500);
    expect(c.fogMistDensityBp).toBeGreaterThanOrEqual(0);
    expect(Math.abs(c.cloudCoverBp - 5_000)).toBeLessThanOrEqual(500);
    expect(c.cloudCoverBp).toBeLessThanOrEqual(10_000);
  });

  it("LIGHT variation is keyed by battle seed (different seed -> different components)", () => {
    const a = initializeBattleWeather(
      makeSeed({
        localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT,
        battleSeed: "seed-x",
      }),
    );
    const b = initializeBattleWeather(
      makeSeed({
        localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT,
        battleSeed: "seed-y",
      }),
    );
    // Different keyed stream -> (overwhelmingly likely) different jittered draws
    expect(a.components.stateHash).not.toBe(b.components.stateHash);
  });

  it("LIGHT variation is deterministic for the same battle seed", () => {
    const a = initializeBattleWeather(
      makeSeed({
        localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT,
        battleSeed: "seed-x",
      }),
    );
    const b = initializeBattleWeather(
      makeSeed({
        localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT,
        battleSeed: "seed-x",
      }),
    );
    expect(a.components.stateHash).toBe(b.components.stateHash);
  });

  it("unknown local-variation policy fails closed", () => {
    expect(() =>
      initializeBattleWeather(makeSeed({ localVariationPolicyId: "bogus_policy_v9" })),
    ).toThrow(BluewaveError);
  });

  it("rejects a non-integer / invalid committed strategic state", () => {
    expect(() =>
      initializeBattleWeather(
        makeSeed({
          strategicWeatherState: strategicState({ seaState: 12 }) as never,
        }),
      ),
    ).toThrow(BluewaveError);
  });

  it("records weather policy version and component version (fail-closed pins)", () => {
    const init = initializeBattleWeather(makeSeed());
    expect(init.weatherPolicyVersion).toBe("weather_v1");
    expect(init.componentsVersion).toBe("weather_components_v1");
  });

  // ---- M5: initialization-boundary failures use INVALID_BATTLE_WEATHER_INITIALIZATION ----
  it("unknown local-variation policy fails with INVALID_BATTLE_WEATHER_INITIALIZATION", () => {
    let caught: unknown;
    try {
      initializeBattleWeather(makeSeed({ localVariationPolicyId: "bogus_policy_v9" }));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(INVALID_BATTLE_WEATHER_INITIALIZATION);
  });

  it("non-integer location fails with INVALID_BATTLE_WEATHER_INITIALIZATION", () => {
    let caught: unknown;
    try {
      initializeBattleWeather(
        makeSeed({
          location: { areaId: "area-eng-ch", xUm: 1.5, yUm: 2_000_000_000 },
        }),
      );
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(INVALID_BATTLE_WEATHER_INITIALIZATION);
  });

  it("battle area id must match the strategic weather source area (cross-area mismatch)", () => {
    let caught: unknown;
    try {
      initializeBattleWeather(makeSeed({ areaId: "area-other" }));
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(INVALID_BATTLE_WEATHER_INITIALIZATION);
  });

  it("location area id must match the battle area id", () => {
    let caught: unknown;
    try {
      initializeBattleWeather(
        makeSeed({
          location: {
            areaId: "area-other",
            xUm: 5_000_000_000,
            yUm: 2_000_000_000,
          },
        }),
      );
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(INVALID_BATTLE_WEATHER_INITIALIZATION);
  });

  // ---- M6: local-variation jitter draws recorded through the RandomLedger port ----
  it("LIGHT local-variation jitter draws are recorded in the RandomLedger", () => {
    const ledger = new RandomLedger();
    initializeBattleWeather(
      makeSeed({
        localVariationPolicyId: LOCAL_VARIATION_POLICY_LIGHT,
        randomLedger: ledger,
      }),
    );
    expect(ledger.all).toHaveLength(3);
    for (const d of ledger.all) {
      expect(d.streamId).toBe("battle/weather/battle-001/local_variation");
      expect(d.entityKey).toBe("battle-001:area-eng-ch");
      expect(d.phase).toBe("battle_weather_initialization");
      expect(typeof d.draw).toBe("number");
    }
  });

  it("NONE local-variation policy records no draws", () => {
    const ledger = new RandomLedger();
    initializeBattleWeather(makeSeed({ randomLedger: ledger }));
    expect(ledger.all).toHaveLength(0);
  });
});
