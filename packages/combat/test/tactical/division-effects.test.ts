import { describe, it, expect } from "vite-plus/test";
import {
  divisionEffectsV1,
  formationLegality,
  roleEligibility,
  isDdScoutEligible,
  EFFECT_CLAMP_MIN,
  EFFECT_CLAMP_MAX,
  VACANT_COMMANDER_MULTIPLIER_BP,
  DD_SCOUT_DISPLACEMENT_KG_MIN,
  DD_SCOUT_SPEED_UMS_MIN,
  DD_SCOUT_READINESS_MIN,
} from "../../src/tactical/division.js";

describe("division effects + role/formation/scout predicates (DESIGN-26 §14/15/16/17)", () => {
  it("§16 division_effects_v1 formulas with exact clamps 7_500..12_500", () => {
    // signaling = 8000 + exp*20
    expect(divisionEffectsV1({ experience: 20, cohesion: 30 }).signaling).toBe(8000 + 20 * 20);
    // contactRetention = 8000 + exp*15 + coh*5
    expect(divisionEffectsV1({ experience: 20, cohesion: 30 }).contactRetention).toBe(
      8000 + 20 * 15 + 30 * 5,
    );
    // formationCohesion = 7500 + coh*25
    expect(divisionEffectsV1({ experience: 0, cohesion: 0 }).formationCohesion).toBe(7500);
    // clamps
    expect(divisionEffectsV1({ experience: 0, cohesion: 0 }).signaling).toBe(8000);
    expect(divisionEffectsV1({ experience: 500, cohesion: 500 }).signaling).toBe(EFFECT_CLAMP_MAX);
    expect(EFFECT_CLAMP_MIN).toBe(7_500);
    expect(EFFECT_CLAMP_MAX).toBe(12_500);
    expect(VACANT_COMMANDER_MULTIPLIER_BP).toBe(9_000);
  });

  it("§14 role eligibility by ship type", () => {
    expect(roleEligibility("CORE", "BB")).toBe(true);
    expect(roleEligibility("CORE", "CL")).toBe(false);
    expect(roleEligibility("SCREEN", "DD")).toBe(true);
    expect(roleEligibility("SCREEN", "BB")).toBe(false);
    expect(roleEligibility("SCOUT", "CL")).toBe(true);
    expect(roleEligibility("SCOUT", "BB")).toBe(false);
    expect(roleEligibility("INDEPENDENT", "AMC")).toBe(true);
  });

  it("§17 formation legality", () => {
    expect(
      formationLegality("LINE_AHEAD", {
        role: "CORE",
        shipCount: 5,
        allDestroyers: false,
        searchCapable: false,
      }),
    ).toBe(true);
    // LINE_ABREAST: at most 5 ships (six-ship DD ineligible)
    expect(
      formationLegality("LINE_ABREAST", {
        role: "CORE",
        shipCount: 5,
        allDestroyers: false,
        searchCapable: false,
      }),
    ).toBe(true);
    expect(
      formationLegality("LINE_ABREAST", {
        role: "CORE",
        shipCount: 6,
        allDestroyers: true,
        searchCapable: false,
      }),
    ).toBe(false);
    // SEARCH_LINE: only SCOUT/PATROL with search capability
    expect(
      formationLegality("SEARCH_LINE", {
        role: "SCOUT",
        shipCount: 3,
        allDestroyers: true,
        searchCapable: true,
      }),
    ).toBe(true);
    expect(
      formationLegality("SEARCH_LINE", {
        role: "CORE",
        shipCount: 3,
        allDestroyers: false,
        searchCapable: true,
      }),
    ).toBe(false);
    // SCREEN: only SCREEN role
    expect(
      formationLegality("SCREEN", {
        role: "SCREEN",
        shipCount: 3,
        allDestroyers: true,
        searchCapable: false,
      }),
    ).toBe(true);
    expect(
      formationLegality("SCREEN", {
        role: "CORE",
        shipCount: 3,
        allDestroyers: false,
        searchCapable: false,
      }),
    ).toBe(false);
  });

  it("§15 DD scout thresholds", () => {
    expect(DD_SCOUT_DISPLACEMENT_KG_MIN).toBe(1_500_000);
    expect(DD_SCOUT_SPEED_UMS_MIN).toBe(15_433_320);
    expect(DD_SCOUT_READINESS_MIN).toBe(60);
    expect(
      isDdScoutEligible({
        displacementKg: 1_500_001,
        designedSpeedUms: 15_433_320,
        readiness: 60,
        searchCapable: true,
      }),
    ).toBe(true);
    // equality at threshold 1_500_000 kg is ineligible
    expect(
      isDdScoutEligible({
        displacementKg: 1_500_000,
        designedSpeedUms: 15_433_320,
        readiness: 60,
        searchCapable: true,
      }),
    ).toBe(false);
    // below 30 knots ineligible
    expect(
      isDdScoutEligible({
        displacementKg: 1_500_001,
        designedSpeedUms: 15_433_319,
        readiness: 60,
        searchCapable: true,
      }),
    ).toBe(false);
  });
});
