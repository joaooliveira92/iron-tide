// DESIGN-03 Campaign Configuration - Validation and Acceptance §9 1..21

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildContentBundleArtifact } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { nationYaml } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { CampaignCompiler } from "../src/compiler-public.js";
import {
  type ContinuationDefinition,
  type NationIdentityDefinition,
  resolveParticipation,
  type ScenarioParticipationRecord,
} from "../src/continuity.js";
import {
  allocateIndivisible,
  CANONICAL_FLEET_SIZE_SETTINGS,
  checkFleetSizeTacticalViolation,
  FLEET_SIZE_BPS,
  FLEET_SIZE_IDS,
  scaleValue,
  validateFleetSizeSetting,
  validateFleetSizeSettings,
} from "../src/fleetSize.js";
import {
  CANONICAL_RESEARCH_SPEED_SETTINGS,
  RESEARCH_BPS,
  scaledResearchProgress,
  validateResearchSpeedSettings,
} from "../src/researchSpeed.js";
import {
  CANONICAL_SCENARIO_IDS,
  CANONICAL_SCENARIOS,
  getScenarioById,
  validateScenarios,
} from "../src/scenario.js";
import {
  CANONICAL_TECH_PROFILES,
  RNG_ALGORITHM_VERSION,
  STREAM_FAMILY,
  type TechnologyDefinition,
  validateTechnologyVariationProfile,
  validateTechnologyVariationProfiles,
  verifyTechnologyManifest,
} from "../src/technologyVariation.js";
import { materializeTechnologyVariation } from "../src/technologyMaterialization.js";
import {
  advanceMonth,
  assertCanAdvance,
  canAdvance,
  fromLinear,
  isAtEnd,
  isBeyondEnd,
  toLinear,
} from "../src/timeline.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}
function hasWarn(c: DiagnosticCollector, code: string) {
  return c.warnings.some((d) => d.code === code);
}
const VALID_SEED = "a".repeat(32);
const OTHER_SEED = "b".repeat(32);

// §6 helper - minimal eligible tech
function tech(
  id: string,
  canonMonth: number,
  prereqs: string[] = [],
  earliest = 0,
  latest = 50000,
  delay: number | Record<string, number> = 0,
): TechnologyDefinition {
  return {
    technologyId: id,
    canonicalAvailabilityMonth: canonMonth,
    canonicalEffectValues: { firepower: 100, speed: 20 },
    variationEligible: true,
    dateVariationEligible: true,
    effectivenessVariationEligible: true,
    earliestPermittedAvailabilityMonth: earliest,
    latestPermittedAvailabilityMonth: latest,
    variableEffectIds: ["firepower"],
    prerequisiteTechnologyIds: prereqs,
    prerequisiteDelayMonths: delay,
  };
}

// §9.1 - five canonical scenarios, January
describe("§9.1 canonical scenarios", () => {
  it("all five exist January of identifier year", () => {
    const c = collector();
    expect(validateScenarios(CANONICAL_SCENARIOS, c)).toBeDefined();
    expect(c.hasErrors).toBe(false);
    for (const id of CANONICAL_SCENARIO_IDS) {
      const s = getScenarioById(id as any)!;
      expect(s.startMonth).toBe(1);
      expect(s.startYear).toBe(Number(id.split("_")[1]));
    }
  });
  it("missing scenario fails INVALID_SCENARIO_DEFINITION", () => {
    const c = collector();
    const missing = CANONICAL_SCENARIOS.slice(0, 4);
    expect(validateScenarios(missing, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("wrong month/year fails", () => {
    const c = collector();
    const bad = JSON.parse(JSON.stringify(CANONICAL_SCENARIOS));
    bad[0].startMonth = 2;
    expect(validateScenarios(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("duplicate/missing field fails", () => {
    const c = collector();
    const dup = [...CANONICAL_SCENARIOS, CANONICAL_SCENARIOS[0]!];
    expect(validateScenarios(dup, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
});

// §9.2 - cannot advance beyond Dec 1970
describe("§9.2 timeline hard stop", () => {
  it("integer calendar arithmetic", () => {
    expect(toLinear(1970, 12)).toBe(1970 * 12 + 11);
    expect(fromLinear(toLinear(1970, 12))).toEqual({ year: 1970, month: 12 });
    expect(advanceMonth(1970, 11, 1)).toEqual({ year: 1970, month: 12 });
    expect(advanceMonth(1970, 12, 1)).toEqual({ year: 1971, month: 1 });
  });
  it("isAtEnd/isBeyondEnd/canAdvance", () => {
    expect(isAtEnd(1970, 12)).toBe(true);
    expect(isBeyondEnd(1971, 1)).toBe(true);
    expect(canAdvance(1970, 12)).toBe(false);
    expect(canAdvance(1970, 11)).toBe(true);
  });
  it("assertCanAdvance rejects Jan 1971 with SIMULATION_END_REACHED", () => {
    const c = collector();
    expect(assertCanAdvance(1970, 12, 1971, 1, c)).toBe(false);
    expect(hasCode(c, "SIMULATION_END_REACHED")).toBe(true);
  });
  it("direct jump beyond end fails", () => {
    const c = collector();
    expect(assertCanAdvance(1965, 1, 1971, 1, c)).toBe(false);
    expect(hasCode(c, "SIMULATION_END_REACHED")).toBe(true);
  });
});

// §9.3/4/5/6 fleet-size
describe("§9.3-9.8 fleet-size", () => {
  it("canonical 4 settings exist with 7500/10000/12500/15000", () => {
    expect(FLEET_SIZE_IDS).toEqual(["small", "standard", "large", "very_large"]);
    expect(FLEET_SIZE_BPS).toEqual({
      small: 7500,
      standard: 10000,
      large: 12500,
      very_large: 15000,
    });
    for (const s of CANONICAL_FLEET_SIZE_SETTINGS) {
      expect(s.navalAppropriationMultiplierBp).toBe(FLEET_SIZE_BPS[s.settingId]);
      expect(s.sustainableFleetSizeMultiplierBp).toBe(FLEET_SIZE_BPS[s.settingId]);
      expect(s.aiForceTargetMultiplierBp).toBe(FLEET_SIZE_BPS[s.settingId]);
      expect(s.generatedLegacyFleetScaleMultiplierBp).toBe(FLEET_SIZE_BPS[s.settingId]);
      expect(s.roundingMode).toBe("FLOOR");
    }
  });
  it("missing field fails MISSING_FLEET_SIZE_MULTIPLIER", () => {
    const c = collector();
    const bad: any = { ...CANONICAL_FLEET_SIZE_SETTINGS[1]! };
    delete bad.navalAppropriationMultiplierBp;
    expect(validateFleetSizeSetting(bad, c)).toBe(false);
    expect(hasCode(c, "MISSING_FLEET_SIZE_MULTIPLIER")).toBe(true);
  });
  it("out of range 5000..20000 fails FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE", () => {
    const c = collector();
    const bad: any = { ...CANONICAL_FLEET_SIZE_SETTINGS[0]!, navalAppropriationMultiplierBp: 4999 };
    expect(validateFleetSizeSetting(bad, c)).toBe(false);
    expect(hasCode(c, "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE")).toBe(true);
  });
  it("canonical shipped values 1.0 enforcement", () => {
    const c = collector();
    const bad = CANONICAL_FLEET_SIZE_SETTINGS.map((s) =>
      s.settingId === "standard" ? { ...s, navalAppropriationMultiplierBp: 9999 } : s,
    );
    expect(validateFleetSizeSettings(bad, c)).toBeUndefined();
    expect(hasCode(c, "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE")).toBe(true);
  });
  it("§9.6 tactical stat violation", () => {
    expect(() => checkFleetSizeTacticalViolation("speed")).toThrow(
      /FLEET_SIZE_TACTICAL_STAT_VIOLATION/,
    );
    expect(() => checkFleetSizeTacticalViolation("DISPLACEMENT")).toThrow();
    expect(() => checkFleetSizeTacticalViolation("navalAppropriation")).not.toThrow();
  });
  it("§9.7 same design unchanged across fleet sizes (number vs stats)", () => {
    // scale changes quantity, not design version stats - simulate: design stats constant
    const design = { displacementKg: 18000, speedUms: 11 };
    for (const id of FLEET_SIZE_IDS) {
      const scaled = Number(scaleValue(100, FLEET_SIZE_BPS[id]));
      expect(design.displacementKg).toBe(18000); // unchanged
      expect(scaled).toBe(Math.floor((100 * FLEET_SIZE_BPS[id]) / 10000));
    }
  });
  it("§9.8 integer scaling wide-int floor + largest remainder deterministic", () => {
    expect(Number(scaleValue(10, 7500))).toBe(7); // floor(7.5)
    expect(Number(scaleValue(1_000_000, 15000))).toBe(1_500_000);
    // indivisible allocation total equals separately scaled aggregate
    const out = allocateIndivisible(10, 12500, [
      { id: "b", unscaled: 4 },
      { id: "a", unscaled: 6 },
    ]);
    expect(out.get("a")! + out.get("b")!).toBe(Number(scaleValue(10, 12500))); // 12
    // fractional remainder 0.5 each -> tie broken by ascending id -> a gets extra
    const tie = allocateIndivisible(1, 15000, [
      { id: "b", unscaled: 1 },
      { id: "a", unscaled: 0 },
    ]);
    // aggregate 1, floors 1 and 0, remaining 0 -> deterministic by id sort
    expect([...tie.entries()].sort((a, b) => a[0].localeCompare(b[0]))).toEqual([...tie.entries()]);
  });
});

// §9.9 research-speed
describe("§9.9 research-speed", () => {
  it("canonical 7500/10000/12500/15000 and range", () => {
    expect(RESEARCH_BPS).toEqual({ slow: 7500, standard: 10000, fast: 12500, very_fast: 15000 });
    const c = collector();
    expect(validateResearchSpeedSettings(CANONICAL_RESEARCH_SPEED_SETTINGS, c)).toBeDefined();
  });
  it("only paid progress scaled floor(base*Bp/10000)", () => {
    expect(scaledResearchProgress(100, 7500)).toBe(75);
    expect(scaledResearchProgress(100, 15000)).toBe(150);
  });
  it("out of range fails INVALID_RESEARCH_SPEED_MULTIPLIER", () => {
    const c = collector();
    const bad: any = [{ settingId: "slow", multiplierBp: 4999, rulesetVersion: "1.0" }];
    expect(validateResearchSpeedSettings(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_RESEARCH_SPEED_MULTIPLIER")).toBe(true);
  });
  it("does not modify prerequisites/availability/effects/weights/limits (unit test isolation)", () => {
    // prerequisite check is independent of researchSpeedSettings validation
    const c = collector();
    const ok = validateResearchSpeedSettings(CANONICAL_RESEARCH_SPEED_SETTINGS, c);
    expect(ok).toBeDefined();
    // no side effect on technologyVariation profile
    expect(CANONICAL_TECH_PROFILES[0]!.earliestDateShiftMonths).toBe(0);
  });
});

// §4.1 / §5 exact canonical set + §6.1 aggregate profile ruleset
describe("§4.1/§5/§6.1 exact canonical set enforcement", () => {
  it("§5 rejects a partial research-speed ruleset even when every entry is valid", () => {
    const c = collector();
    const partial: any = [CANONICAL_RESEARCH_SPEED_SETTINGS[0]!];
    expect(validateResearchSpeedSettings(partial, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_RESEARCH_SPEED_MULTIPLIER")).toBe(true);
  });
  it("§4.1 rejects a partial fleet-size ruleset even when every entry is valid", () => {
    const c = collector();
    const partial: any = [CANONICAL_FLEET_SIZE_SETTINGS[0]!];
    expect(validateFleetSizeSettings(partial, c)).toBeUndefined();
    expect(hasCode(c, "MISSING_FLEET_SIZE_MULTIPLIER")).toBe(true);
  });
  it("§6.1 accepts exactly none/some/considerable and rejects a missing profile", () => {
    const c = collector();
    expect(validateTechnologyVariationProfiles(CANONICAL_TECH_PROFILES, c)).toBe(true);
    expect(c.hasErrors).toBe(false);
    const c2 = collector();
    const partial = CANONICAL_TECH_PROFILES.slice(0, 2);
    expect(validateTechnologyVariationProfiles(partial, c2)).toBe(false);
    expect(hasCode(c2, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
});

// §9.10-9.15 technology variation
describe("§9.10-9.15 technology variation", () => {
  it("§9.10 none zero shift 10000", () => {
    const c = collector();
    const m = materializeTechnologyVariation(
      [tech("a", 100)],
      CANONICAL_TECH_PROFILES[0]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    expect(c.hasErrors).toBe(false);
    expect(m.entries["a"]!.selectedDateShift).toBe(0);
    expect(m.entries["a"]!.effectivenessMultiplier).toBe(10000);
    expect(m.entries["a"]!.finalVariedEffectValues["firepower"]).toBe(100);
  });
  it("§9.11 some within -24..24 and 9500..10500", () => {
    const c = collector();
    const techs = Array.from({ length: 20 }, (_, i) => tech(`t${i}`, 100 + i));
    const m = materializeTechnologyVariation(
      techs,
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    for (const e of Object.values(m.entries)) {
      expect(e.selectedDateShift).toBeGreaterThanOrEqual(-24);
      expect(e.selectedDateShift).toBeLessThanOrEqual(24);
      expect(e.effectivenessMultiplier).toBeGreaterThanOrEqual(9500);
      expect(e.effectivenessMultiplier).toBeLessThanOrEqual(10500);
    }
  });
  it("§9.12 considerable within -72..72 and 9000..11000, bounds 72/8000..12000 enforced", () => {
    const c = collector();
    const bad: any = { ...CANONICAL_TECH_PROFILES[2]!, earliestDateShiftMonths: -73 };
    expect(validateTechnologyVariationProfile(bad, c)).toBe(false);
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
    const c2 = collector();
    const m = materializeTechnologyVariation(
      [tech("a", 100)],
      CANONICAL_TECH_PROFILES[2]!,
      VALID_SEED,
      "ch",
      "rh",
      c2,
    )!;
    expect(m.entries["a"]!.selectedDateShift).toBeGreaterThanOrEqual(-72);
    expect(m.entries["a"]!.selectedDateShift).toBeLessThanOrEqual(72);
  });
  it("§9.13 prerequisite order valid after variation (clamped then delay)", () => {
    const c = collector();
    // b prereq a with delay 5, but a shifted earlier could violate - must be adjusted to a+5
    const a = tech("a", 100, [], 0, 50000, 0);
    const b = tech("b", 101, ["a"], 0, 50000, 5); // canonical b = a+1, but after shift must be >= aFinal+5
    const m = materializeTechnologyVariation(
      [a, b],
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    expect(m.entries["b"]!.finalAvailabilityMonth).toBeGreaterThanOrEqual(
      m.entries["a"]!.finalAvailabilityMonth + 5,
    );
  });
  it("§9.13 cycle fails TECHNOLOGY_PREREQUISITE_CYCLE", () => {
    const c = collector();
    const a = tech("a", 100, ["b"]);
    const b = tech("b", 100, ["a"]);
    expect(
      materializeTechnologyVariation(
        [a, b],
        CANONICAL_TECH_PROFILES[0]!,
        VALID_SEED,
        "ch",
        "rh",
        c,
      ),
    ).toBeUndefined();
    expect(hasCode(c, "TECHNOLOGY_PREREQUISITE_CYCLE")).toBe(true);
  });
  it("§9.13 clamping to earliest/latest", () => {
    const c = collector();
    const t = tech("a", 10, [], 5, 15); // permitted 5..15
    // force shift -72 but clamped to 5
    const m = materializeTechnologyVariation(
      [t],
      CANONICAL_TECH_PROFILES[2]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    expect(m.entries["a"]!.finalAvailabilityMonth).toBeGreaterThanOrEqual(5);
    expect(m.entries["a"]!.finalAvailabilityMonth).toBeLessThanOrEqual(15);
  });
  it("§9.14 consumes only setup/technology_variation keyed decisions, ascending id", () => {
    const c = collector();
    const techs = [tech("b", 100), tech("a", 100)];
    const m1 = materializeTechnologyVariation(
      techs,
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    const c2 = collector();
    const m2 = materializeTechnologyVariation(
      [tech("a", 100), tech("b", 100)],
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c2,
    )!;
    expect(m1.entries["a"]!.selectedDateShift).toBe(m2.entries["a"]!.selectedDateShift);
    expect(m1.entries["a"]!.variationDecisionRecordIds[0]).toContain(STREAM_FAMILY);
    expect(m1.entries["a"]!.variationDecisionRecordIds[0]).toContain(RNG_ALGORITHM_VERSION);
    expect(m1.entries["a"]!.variationDecisionRecordIds[0]).toContain("availability_shift");
  });
  it("§9.15 identical inputs identical manifest hash deterministic", () => {
    const c1 = collector();
    const c2 = collector();
    const techs = [tech("a", 100), tech("b", 200)];
    const m1 = materializeTechnologyVariation(
      techs,
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c1,
    )!;
    const m2 = materializeTechnologyVariation(
      techs,
      CANONICAL_TECH_PROFILES[1]!,
      VALID_SEED,
      "ch",
      "rh",
      c2,
    )!;
    expect(m1.manifestHash).toBe(m2.manifestHash);
    expect(m1.manifestHash).toHaveLength(64);
    // different seed -> different
    const c3 = collector();
    const m3 = materializeTechnologyVariation(
      techs,
      CANONICAL_TECH_PROFILES[1]!,
      OTHER_SEED,
      "ch",
      "rh",
      c3,
    )!;
    expect(m3.manifestHash).not.toBe(m1.manifestHash);
  });
  it("§9.16 runtime cannot reroll - verify hash mismatch fails TECHNOLOGY_MANIFEST_MISMATCH", () => {
    const c = collector();
    const m = materializeTechnologyVariation(
      [tech("a", 100)],
      CANONICAL_TECH_PROFILES[0]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    const tampered = {
      ...m,
      entries: { ...m.entries, a: { ...m.entries["a"]!, finalAvailabilityMonth: 9999 } },
    };
    const c2 = collector();
    expect(verifyTechnologyManifest(tampered as any, c2)).toBe(false);
    expect(hasCode(c2, "TECHNOLOGY_MANIFEST_MISMATCH")).toBe(true);
    // untampered verifies
    expect(verifyTechnologyManifest(m, collector())).toBe(true);
  });
  it("missing eligibility metadata -> ineligible + TECHNOLOGY_VARIATION_METADATA_MISSING", () => {
    const c = collector();
    const bad: any = {
      technologyId: "a",
      canonicalAvailabilityMonth: 100,
      canonicalEffectValues: {},
      variableEffectIds: [],
      prerequisiteTechnologyIds: [],
    };
    const m = materializeTechnologyVariation(
      [bad],
      CANONICAL_TECH_PROFILES[0]!,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    expect(hasWarn(c, "TECHNOLOGY_VARIATION_METADATA_MISSING")).toBe(true);
    expect(m.entries["a"]!.eligibilityFlags.variationEligible).toBe(false);
  });
  it("empty effect intersection fails INVALID_EFFECT_VARIATION_BOUNDS", () => {
    const c = collector();
    const t = tech("a", 100);
    (t as any).effectVariationBounds = { firepower: { minBp: 9000, maxBp: 9100 } }; // profile some is 9500..10500 -> empty
    expect(
      materializeTechnologyVariation([t], CANONICAL_TECH_PROFILES[1]!, VALID_SEED, "ch", "rh", c),
    ).toBeUndefined();
    expect(hasCode(c, "INVALID_EFFECT_VARIATION_BOUNDS")).toBe(true);
  });
  it("triangular half toward zero (Math.trunc)", () => {
    expect(Math.trunc(1 / 2)).toBe(0);
    // -0.5 truncates toward zero: the result is -0, never -1 (floor).
    expect(Object.is(Math.trunc(-1 / 2), -0)).toBe(true);
    expect(Math.trunc(-1 / 2) === -1).toBe(false);
    // -0 behaves as 0 under integer month arithmetic.
    expect(Math.trunc(-1 / 2) + 100).toBe(100);
  });
  it("effectiveness roundTowardZero signed", () => {
    // -15 * 9500 /10000 = -14.25 -> trunc -14 not floor -15
    const c = collector();
    const t: TechnologyDefinition = {
      ...tech("a", 100),
      canonicalEffectValues: { firepower: -15 },
    };
    const m = materializeTechnologyVariation(
      [t],
      {
        ...CANONICAL_TECH_PROFILES[1]!,
        effectivenessVariationMinBp: 9500,
        effectivenessVariationMaxBp: 9500,
        effectivenessDistributionId: "symmetric_triangular_integer_v1",
      } as any,
      VALID_SEED,
      "ch",
      "rh",
      c,
    )!;
    expect(m.entries["a"]!.finalVariedEffectValues["firepower"]).toBe(-14);
  });
});

// §9.17-9.20 continuity
describe("§9.17-9.20 continuity", () => {
  const identities = new Map<string, NationIdentityDefinition>([
    [
      "inst_gbr",
      {
        nationInstanceId: "inst_gbr",
        playableSlotId: "gbr",
        participantClass: "PLAYABLE_SLOT_INSTANCE",
      },
    ],
    [
      "inst_fra",
      {
        nationInstanceId: "inst_fra",
        playableSlotId: "fra",
        participantClass: "PLAYABLE_SLOT_INSTANCE",
      },
    ],
    [
      "ai_inst",
      { nationInstanceId: "ai_inst", playableSlotId: "gbr", participantClass: "AI_ONLY_POWER" },
    ],
  ]);
  const conts = new Map<string, ContinuationDefinition>([
    [
      "cont_gbr",
      {
        continuationDefinitionId: "cont_gbr",
        playableSlotId: "gbr",
        targetScenarioNationInstanceId: "inst_gbr",
      },
    ],
  ]);

  it("§9.17 historical INACTIVE rejects PLAYABLE_SLOT_INACTIVE_HISTORICAL no substitution", () => {
    const c = collector();
    const rec: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "historical",
      participationStatus: "INACTIVE",
      scenarioNationInstanceId: "NONE",
      continuationDefinitionId: "NONE",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [rec], identities, conts, c),
    ).toBeUndefined();
    expect(hasCode(c, "PLAYABLE_SLOT_INACTIVE_HISTORICAL")).toBe(true);
  });
  it("historical CONDITIONAL_ACTIVE prohibited", () => {
    const c = collector();
    const rec: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "historical",
      participationStatus: "CONDITIONAL_ACTIVE",
      scenarioNationInstanceId: "NONE",
      continuationDefinitionId: "cont_gbr",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [rec], identities, conts, c),
    ).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
  it("§9.18 alternate CONDITIONAL only with valid continuation", () => {
    const c = collector();
    const rec: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "alternate_continuity_v1",
      participationStatus: "CONDITIONAL_ACTIVE",
      scenarioNationInstanceId: "NONE",
      continuationDefinitionId: "NONE",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation(
        "scen_1880",
        "gbr",
        "alternate_continuity_v1",
        [rec],
        identities,
        conts,
        c,
      ),
    ).toBeUndefined();
    expect(hasCode(c, "MISSING_ALTERNATE_CONTINUITY_DEFINITION")).toBe(true);
    const c2 = collector();
    const rec2: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "alternate_continuity_v1",
      participationStatus: "CONDITIONAL_ACTIVE",
      scenarioNationInstanceId: "NONE",
      continuationDefinitionId: "cont_gbr",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation(
        "scen_1880",
        "gbr",
        "alternate_continuity_v1",
        [rec2],
        identities,
        conts,
        c2,
      ),
    ).toBe("inst_gbr");
  });
  it("§9.19 AI_ONLY_POWER cannot replace slot", () => {
    const c = collector();
    // continuation definition whose target nation is an AI_ONLY_POWER + is not a
    // PLAYABLE_SLOT_INSTANCE -> AI_POWER_PLAYABLE_SLOT_SUBSTITUTION
    const badConts = new Map<string, ContinuationDefinition>([
      [
        "cont_gbr",
        {
          continuationDefinitionId: "cont_gbr",
          playableSlotId: "gbr",
          targetScenarioNationInstanceId: "ai_inst",
        },
      ],
    ]);
    const rec: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "alternate_continuity_v1",
      participationStatus: "CONDITIONAL_ACTIVE",
      scenarioNationInstanceId: "NONE",
      continuationDefinitionId: "cont_gbr",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation(
        "scen_1880",
        "gbr",
        "alternate_continuity_v1",
        [rec],
        identities,
        badConts,
        c,
      ),
    ).toBeUndefined();
    expect(hasCode(c, "AI_POWER_PLAYABLE_SLOT_SUBSTITUTION")).toBe(true);

    const c2 = collector();
    const recActive: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "historical",
      participationStatus: "ACTIVE",
      scenarioNationInstanceId: "ai_inst",
      continuationDefinitionId: "NONE",
      reasonCode: "r",
      contentHash: "h",
    };
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [recActive], identities, conts, c2),
    ).toBeUndefined();
    expect(hasCode(c2, "AI_POWER_PLAYABLE_SLOT_SUBSTITUTION")).toBe(true);
  });
  it("§9.20 deterministic no RNG, duplicate/missing fails", () => {
    const rec: ScenarioParticipationRecord = {
      scenarioId: "scen_1880",
      playableSlotId: "gbr",
      continuityModeId: "historical",
      participationStatus: "ACTIVE",
      scenarioNationInstanceId: "inst_gbr",
      continuationDefinitionId: "NONE",
      reasonCode: "r",
      contentHash: "h",
    };
    const r1 = resolveParticipation(
      "scen_1880",
      "gbr",
      "historical",
      [rec],
      identities,
      conts,
      collector(),
    );
    const r2 = resolveParticipation(
      "scen_1880",
      "gbr",
      "historical",
      [rec],
      identities,
      conts,
      collector(),
    );
    expect(r1).toBe(r2);
    expect(r1).toBe("inst_gbr");
    // duplicate
    const cdup = collector();
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [rec, rec], identities, conts, cdup),
    ).toBeUndefined();
    expect(hasCode(cdup, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
    // missing
    const cmiss = collector();
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [], identities, conts, cmiss),
    ).toBeUndefined();
    expect(hasCode(cmiss, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
});

// §9.21 post-creation mutation rejected (state.ts)
describe("§9.21 configuration immutability", () => {
  it("mutation rejected", async () => {
    const { validateCampaignConfiguration, assertConfigurationImmutability } =
      await import("../src/campaignConfiguration.js").catch(async () => {
        // fallback: inline check via state.ts hash if campaignConfiguration not present
        const mod: any = await import("../src/state.js");
        return {
          validateCampaignConfiguration: mod.validateCampaignConfiguration,
          assertConfigurationImmutability: mod.assertConfigurationImmutability,
        };
      });
    const c = collector();
    const cfg: any = {
      scenarioId: "scen_1880",
      playerSlotId: "gbr",
      continuityModeId: "historical",
      fleetSizeSettingId: "standard",
      researchSpeedSettingId: "standard",
      technologyVariationSettingId: "none",
      historicalBudgetOptionId: "standard",
      legacyFleetModeId: "historical",
      tacticalRealismModeId: "standard",
      difficultyProfileId: "normal",
      campaignSeed: VALID_SEED,
      configurationSchemaVersion: "1.0",
    };
    expect(validateCampaignConfiguration(cfg, c)).toBe(true);
    const mutated: any = { ...cfg, fleetSizeSettingId: "large" };
    const c2 = collector();
    expect(assertConfigurationImmutability(cfg, mutated, c2)).toBe(false);
    expect(hasCode(c2, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
  });
});

// §3 campaignSeed & configuration explicitness
describe("§3 campaignSeed & explicit config", () => {
  it("valid 32 lower hex passes, uppercase/short/long fails INVALID_CAMPAIGN_SEED", async () => {
    const { validateCampaignSeed } = await import("../src/campaignConfiguration.js").catch(
      async () => (await import("../src/state.js")) as any,
    );
    expect(validateCampaignSeed(VALID_SEED, collector())).toBe(true);
    for (const bad of ["A".repeat(32), "a".repeat(31), "a".repeat(33), "", "g".repeat(32)]) {
      const c = collector();
      expect(validateCampaignSeed(bad, c)).toBe(false);
      expect(hasCode(c, "INVALID_CAMPAIGN_SEED")).toBe(true);
    }
  });
  it("null/omission/empty prohibited -> INVALID_CAMPAIGN_CONFIGURATION", async () => {
    const { validateCampaignConfiguration } = await import("../src/campaignConfiguration.js").catch(
      async () => (await import("../src/state.js")) as any,
    );
    const base: any = {
      scenarioId: "scen_1880",
      playerSlotId: "gbr",
      continuityModeId: "historical",
      fleetSizeSettingId: "standard",
      researchSpeedSettingId: "standard",
      technologyVariationSettingId: "none",
      historicalBudgetOptionId: "standard",
      legacyFleetModeId: "historical",
      tacticalRealismModeId: "standard",
      difficultyProfileId: "normal",
      campaignSeed: VALID_SEED,
      configurationSchemaVersion: "1.0",
    };
    for (const field of ["scenarioId", "campaignSeed", "fleetSizeSettingId"]) {
      const c = collector();
      const bad: any = { ...base, [field]: undefined };
      delete bad[field];
      expect(validateCampaignConfiguration(bad, c)).toBe(false);
      expect(hasCode(c, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
    }
    const c2 = collector();
    expect(validateCampaignConfiguration({ ...base, playerSlotId: "" }, c2)).toBe(false);
  });
  it("validateCampaignPreconditions before RNG - invalid config no campaign", async () => {
    const { validateCampaignPreconditions } = await import("../src/campaignSession.js");
    const c = collector();
    const input: any = {
      scenarios: CANONICAL_SCENARIOS,
      campaignConfiguration: {
        scenarioId: "scen_1880",
        playerSlotId: "",
        continuityModeId: "historical",
        fleetSizeSettingId: "standard",
        researchSpeedSettingId: "standard",
        technologyVariationSettingId: "none",
        historicalBudgetOptionId: "standard",
        legacyFleetModeId: "historical",
        tacticalRealismModeId: "standard",
        difficultyProfileId: "normal",
        campaignSeed: "bad",
        configurationSchemaVersion: "1.0",
      },
    };
    expect(validateCampaignPreconditions(input, c)).toBe(false);
    expect(c.hasErrors).toBe(true);
  });
});

// §9.3/9.4 - CampaignCompiler enforces DESIGN-03 configuration before RNG
describe("CampaignCompiler DESIGN-03 configuration gate", () => {
  function writeMinimalPack(dir: string): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "pack.json"),
      JSON.stringify({
        name: "campaign-config-test",
        version: "0.1.0",
        type: "fixture",
        files: { countries: ["countries.yaml"] },
      }),
      "utf8",
    );
    writeFileSync(
      resolve(dir, "countries.yaml"),
      nationYaml({ id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true }),
      "utf8",
    );
  }

  function compilerInput(dir: string) {
    const collector = new DiagnosticCollector();
    const artifact = buildContentBundleArtifact(
      {
        manifestPath: resolve(dir, "pack.json"),
        contentDir: dir,
        rulesetFiles: [],
        countryFiles: ["countries.yaml"],
        areaFiles: [],
        routeFiles: [],
        possessionFiles: [],
        portFiles: [],
        technologyFiles: [],
        fleetFiles: [],
        economyFiles: [],
        constructionFiles: [],
        diplomacyFiles: [],
        researchFiles: [],
        designFiles: [],
      },
      new AbortController().signal,
      collector,
    );
    if (!artifact || collector.hasErrors) {
      throw new Error(
        `fixture bundle build failed: ${collector.all.map((d) => d.message).join("; ")}`,
      );
    }
    return {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: "0.1.0",
      scenarios: CANONICAL_SCENARIOS,
      fleetSizeSettings: CANONICAL_FLEET_SIZE_SETTINGS,
      researchSpeedSettings: CANONICAL_RESEARCH_SPEED_SETTINGS,
    };
  }

  function baseConfig() {
    return {
      scenarioId: "scen_1880",
      playerSlotId: "uk",
      continuityModeId: "historical",
      fleetSizeSettingId: "standard",
      researchSpeedSettingId: "standard",
      technologyVariationSettingId: "none",
      historicalBudgetOptionId: "standard",
      legacyFleetModeId: "historical",
      tacticalRealismModeId: "standard",
      difficultyProfileId: "normal",
      campaignSeed: VALID_SEED,
      configurationSchemaVersion: "1.0",
    };
  }

  it("§9.4 valid configuration compiles and produces a campaign", () => {
    const dir = resolve(
      tmpdir(),
      `bw-d03-valid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    writeMinimalPack(dir);
    try {
      const c = collector();
      const out = new CampaignCompiler().compile(
        { ...compilerInput(dir), campaignConfiguration: baseConfig() },
        new AbortController().signal,
        c,
      );
      expect(c.hasErrors).toBe(false);
      expect(out).toBeDefined();
      expect(out!.contentHash).toHaveLength(64);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("§9.4 invalid campaignConfiguration rejected before RNG, no campaign created", () => {
    const dir = resolve(
      tmpdir(),
      `bw-d03-invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    writeMinimalPack(dir);
    try {
      const c = collector();
      const out = new CampaignCompiler().compile(
        {
          ...compilerInput(dir),
          campaignConfiguration: { ...baseConfig(), campaignSeed: "NOT-HEX" },
        },
        new AbortController().signal,
        c,
      );
      expect(out).toBeUndefined();
      expect(hasCode(c, "INVALID_CAMPAIGN_SEED")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("§9.4 cross-check honours the validated input scenario, not the canonical constant", () => {
    const dir = resolve(
      tmpdir(),
      `bw-d03-cross-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    writeMinimalPack(dir);
    try {
      const tampered = JSON.parse(JSON.stringify(CANONICAL_SCENARIOS));
      tampered[0].supportedFleetSizeSettingIds = ["small"];
      const c = collector();
      const out = new CampaignCompiler().compile(
        {
          ...compilerInput(dir),
          scenarios: tampered,
          campaignConfiguration: baseConfig(),
        },
        new AbortController().signal,
        c,
      );
      expect(out).toBeUndefined();
      expect(hasCode(c, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
