import { describe, expect, it } from "vite-plus/test";
import {
  separationChanceBp,
  separationWeather,
  type NavigationSeparationRules,
} from "@bluewave/combat/navigation";
import { withTacticalWeatherComponentsHash } from "@bluewave/combat/weather";
import { SEPARATION_BLOCK } from "./separationScenario.js";

const RULES: NavigationSeparationRules = { ...SEPARATION_BLOCK };
const DAY = { night: false, visibilityUm: undefined };

function components(timeOfDay: "DAY" | "NIGHT" | "TWILIGHT_NIGHT", fogMistDensityBp = 0) {
  return withTacticalWeatherComponentsHash({
    battleId: "b1",
    seaState: 3,
    windDirectionDeg: 270,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp,
    cloudCoverBp: 5_000,
    timeOfDay,
    solarBearingDeg: 0,
    solarElevationDeg: 20,
    glareIntensityBp: 0,
    baseVisibilityUm: 60_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
  });
}

describe("separation chance (#941)", () => {
  it("is the formation base in basis points at full cohesion by day", () => {
    const rules = {
      ...RULES,
      formationBaseBp: { LINE_ABREAST: 40, SEARCH_LINE: 60, SCREEN: 50 },
    };
    expect(separationChanceBp(rules, "LINE_ABREAST", DAY, 10_000)).toBe(40);
    expect(separationChanceBp(rules, "SEARCH_LINE", DAY, 10_000)).toBe(60);
    expect(separationChanceBp(rules, "SCREEN", DAY, 10_000)).toBe(50);
  });

  it("multiplies in the night and poor visibility factors", () => {
    const rules = { ...RULES, formationBaseBp: { ...RULES.formationBaseBp, LINE_ABREAST: 1_000 } };
    expect(
      separationChanceBp(rules, "LINE_ABREAST", { night: true, visibilityUm: undefined }, 10_000),
    ).toBe(1_500);
    expect(
      separationChanceBp(
        rules,
        "LINE_ABREAST",
        { night: false, visibilityUm: 1_000_000_000 },
        10_000,
      ),
    ).toBe(2_000);
    expect(
      separationChanceBp(
        rules,
        "LINE_ABREAST",
        { night: true, visibilityUm: 1_000_000_000 },
        10_000,
      ),
    ).toBe(3_000);
  });

  it("rises as the division cohesion falls and never exceeds 10000", () => {
    const rules = { ...RULES, formationBaseBp: { ...RULES.formationBaseBp, SCREEN: 3_000 } };
    expect(separationChanceBp(rules, "SCREEN", DAY, 7_500)).toBe(4_000);
    expect(separationChanceBp(rules, "SCREEN", { night: true, visibilityUm: 1 }, 7_500)).toBe(
      10_000,
    );
  });

  it("reads night and effective visibility from the weather components", () => {
    expect(separationWeather(undefined)).toEqual({ night: false, visibilityUm: undefined });
    expect(separationWeather(components("DAY")).night).toBe(false);
    expect(separationWeather(components("NIGHT")).night).toBe(true);
    expect(separationWeather(components("TWILIGHT_NIGHT")).night).toBe(true);
    const clear = separationWeather(components("DAY")).visibilityUm!;
    const foggy = separationWeather(components("DAY", 9_000)).visibilityUm!;
    expect(foggy).toBeLessThan(clear);
  });
});
