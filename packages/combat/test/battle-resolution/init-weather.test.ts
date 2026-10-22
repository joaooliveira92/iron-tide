import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { buildBattleWeather } from "../../src/battleResolution/weather.js";
import {
  INVALID_BATTLE_WEATHER_INITIALIZATION,
  WEATHER_PROFILE_INCOMPLETE,
} from "../../src/weather/reasonCodes.js";
import { LOCAL_VARIATION_POLICY_NONE } from "../../src/weather/constants.js";
import { makeAutoInput } from "./fixtures.js";

describe("AC-3: battle weather initialization from the committed strategic state", () => {
  it("builds one initialization + engine context from the strategic state", () => {
    const input = makeAutoInput();
    const bw = buildBattleWeather({
      battleId: input.manifest.battleId,
      areaId: input.areaId,
      campaignMonth: input.campaignMonth,
      strategicWeather: input.strategicWeather,
      battleSeed: "battle-seed-abc",
    });

    expect(bw.initialization.strategicWeatherStateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bw.initialization.battleDate).toBe("1880-06-15");
    expect(bw.initialization.battleStartTime).toBe("06:00");
    expect(bw.initialization.localVariationPolicyId).toBe(LOCAL_VARIATION_POLICY_NONE);
    expect(bw.initialization.components.baseVisibilityUm).toBe(
      input.strategicWeather.baseVisibilityUm,
    );
    expect(bw.initialization.components.timeOfDay).toBe("DAY");
    expect(bw.initialization.initializationHash).toMatch(/^[0-9a-f]{64}$/);

    expect(bw.context.components.stateHash).toBe(bw.initialization.components.stateHash);
    expect(bw.context.seasonId).toBe(input.strategicWeather.seasonId);
    expect(bw.context.battleStartMinutes).toBe(360);
    expect(bw.context.battleSeed).toBe("battle-seed-abc");
  });

  it("same inputs produce identical initializations (determinism)", () => {
    const a = buildBattleWeather({
      battleId: "b1",
      areaId: "area-eng-ch",
      campaignMonth: "1880-06",
      strategicWeather: makeAutoInput().strategicWeather,
      battleSeed: "seed-x",
    });
    const b = buildBattleWeather({
      battleId: "b1",
      areaId: "area-eng-ch",
      campaignMonth: "1880-06",
      strategicWeather: makeAutoInput().strategicWeather,
      battleSeed: "seed-x",
    });
    expect(a.initialization.initializationHash).toBe(b.initialization.initializationHash);
    expect(a.context.components.stateHash).toBe(b.context.components.stateHash);
  });

  it("missing strategic weather fails closed with INVALID_BATTLE_WEATHER_INITIALIZATION", () => {
    let caught: unknown;
    try {
      buildBattleWeather({
        battleId: "b1",
        areaId: "area-eng-ch",
        campaignMonth: "1880-06",
        strategicWeather: undefined as never,
        battleSeed: "seed-x",
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(INVALID_BATTLE_WEATHER_INITIALIZATION);
  });

  it("unknown climate/daylight profile ids fail closed with WEATHER_PROFILE_INCOMPLETE", () => {
    const base = makeAutoInput();
    for (const overrides of [
      { climateProfileId: "no-such-profile" },
      { daylightProfileId: "no-such-daylight" },
    ]) {
      let caught: unknown;
      try {
        buildBattleWeather({
          battleId: "b1",
          areaId: "area-eng-ch",
          campaignMonth: "1880-06",
          strategicWeather: {
            ...base.strategicWeather,
            ...overrides,
          },
          battleSeed: "seed-x",
        });
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
    }
  });

  it("the orchestrator input path resolves the shipped profile ids", () => {
    const input = makeAutoInput();
    const bw = buildBattleWeather({
      battleId: input.manifest.battleId,
      areaId: input.areaId,
      campaignMonth: input.campaignMonth,
      strategicWeather: input.strategicWeather,
      battleSeed: "battle-seed-xyz",
    });
    expect(bw.initialization.componentsVersion).toMatch(/^weather_components_v1$/);
  });
});
