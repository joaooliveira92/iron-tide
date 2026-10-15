// AC-24 seeds (INC-1 + INC-2 + INC-3): `torpedo_v1` SHIPPED_TORPEDO_CONTRACT +
// validate guard fail-closed on tampering; exact shipped §7/§8/§10/§11/§23/§24
// integers; the grounded seed model set; the in-slice reason-code catalog
// (exactly the INC-1 + INC-2 + INC-3 §29 codes, disjoint from the top-level
// combat catalog — the full §29 partition set-equality test is the INC-8
// deliverable). The INC-2 DEFERRED marker is RETIRED in INC-3: no shipped
// predicate reports it and it is absent from the catalog.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { REASON_CODES } from "../../src/reasonCodes.js";
import {
  ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS,
  ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS,
  INVALID_TORPEDO_MODEL_DEFINITION,
  OXYGEN_RANGE_MULTIPLIER_BP,
  resolvedAboveWaterMaxLaunchSpeedKnots,
  SHIPPED_TORPEDO_CONTRACT,
  SHIPPED_TORPEDO_DETONATION_CONTRACT,
  SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
  TORPEDO_DANGER_SECTOR_RAD_TO_MDEG,
  TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP,
  TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP,
  TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M,
  TORPEDO_MAX_LAUNCH_SEA_STATE,
  TORPEDO_MISSION_OBJECTIVES,
  TORPEDO_MOUNT_TYPES,
  TORPEDO_REASON_CODES,
  TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE,
  TORPEDO_SALVO_BASE_TUBES,
  TORPEDO_SALVO_BP_PER_TUBE,
  TORPEDO_SALVO_FACTOR_WEIGHTS_BP,
  TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
  TORPEDO_SALVO_MIN_TUBES,
  TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE,
  TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES,
  SEED_TORPEDO_MODEL_IDS,
  TORPEDO_SOLUTION_FACTOR_KEYS,
  TORPEDO_SOLUTION_FINAL_MAX_BP,
  TORPEDO_SOLUTION_FINAL_MIN_BP,
  TORPEDO_SOLUTION_MINIMUM_BP,
  TORPEDO_SOLUTION_ROUNDING,
  TORPEDO_SOLUTION_SCALE_EXPONENT,
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_TARGET_CONTACT_MINIMUM_BP,
  torpedoPolicyId,
  torpedoSpeedBpKnotsToUmS,
  UNDERWATER_TUBE_MAX_SPEED_KNOTS,
  UNDERWATER_TUBE_MAX_SPEED_UM_S,
  UNIDENTIFIED_CONTACT_IDENTITY,
  validateTorpedoContract,
  validateTorpedoDetonationContract,
  validateTorpedoLauncherDefinition,
  validateTorpedoLaunchAuthorityContract,
  type TorpedoLauncherDefinition,
  // INC-6 (damage package): §16-§23 contracts + guards
  SHIPPED_TORPEDO_DAMAGE_CONTRACT,
  validateTorpedoDamageContract,
  SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT,
  validateUnderwaterTubeHitHazardContract,
  underwaterTubeHitHazardPolicyId,
  TORPEDO_TUBE_HAZARD_BASE_BP,
  TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP,
  TORPEDO_NON_MACHINERY_ELIGIBILITY_BP,
  TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
  TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
  TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP,
  TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ,
  TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ,
  TORPEDO_TUBE_CREW_CASUALTY_BASE_BP,
  TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP,
  TORPEDO_SEAWATER_DENSITY_KG_PER_M3,
  TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M,
} from "../../src/torpedoes/index.js";

describe("AC-24: torpedo_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_TORPEDO_CONTRACT", () => {
    expect(torpedoPolicyId).toBe("torpedo_v1");
    expect(SHIPPED_TORPEDO_CONTRACT.policyId).toBe("torpedo_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateTorpedoContract(SHIPPED_TORPEDO_CONTRACT)).not.toThrow();
  });

  it("fails closed on a mismatched policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, policyId: "x" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("fails closed on a tampered scale constant", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, basisPointsPerUnit: 999 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered mount-type closed enum (sixth value)", () => {
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        mountTypes: [...TORPEDO_MOUNT_TYPES, "SURFACE_TRAINABLE"],
      } as Partial<typeof SHIPPED_TORPEDO_CONTRACT>),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §7 underwater-tube speed limit", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, underwaterTubeMaxSpeedUmS: 1 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §6 target-contact minimum", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, targetContactMinimumBp: 4_001 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §10 solution minimum (single kind or missing kinds)", () => {
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        solutionMinimumBp: { ...SHIPPED_TORPEDO_CONTRACT.solutionMinimumBp, AUTOMATED: 5_001 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, solutionMinimumBp: {} as never }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §6 sea-state launch ceiling", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, maxLaunchSeaState: 6 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §23 oxygen constant", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, oxygenRangeMultiplierBp: 9_999 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered shipped-model-id list", () => {
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, shippedModelIds: [] }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §10 solution factor manifest or scale", () => {
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        solutionFactorKeys: [...TORPEDO_SOLUTION_FACTOR_KEYS, "magic"],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, solutionScaleExponent: 9 }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, solutionRounding: "ceil" }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, solutionFinalMaxBp: 9_999 }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §24 friendly-fire constant", () => {
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        friendlyDangerSectorMinimumBp: 7_499,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, friendlyFireMinSeparationM: 999 }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, dangerSectorRadToMdeg: 57_295 }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({ ...SHIPPED_TORPEDO_CONTRACT, unidentifiedContactIdentity: "?" }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §11 salvo policy constant", () => {
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        salvoBaseTubes: { ...SHIPPED_TORPEDO_CONTRACT.salvoBaseTubes, ATTACK: 3 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        salvoFactorWeightsBp: { ...SHIPPED_TORPEDO_CONTRACT.salvoFactorWeightsBp, overkill: 999 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        salvoRangePressureBpTable: [...SHIPPED_TORPEDO_CONTRACT.salvoRangePressureBpTable],
      }),
    ).not.toThrow(); // the unmodified copy still validates
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        salvoRangePressureBpTable: [
          { maxRangeM: 2_000, pressureBp: 1 },
          ...SHIPPED_TORPEDO_CONTRACT.salvoRangePressureBpTable.slice(1),
        ],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoContract({
        ...SHIPPED_TORPEDO_CONTRACT,
        missionObjectives: [...TORPEDO_MISSION_OBJECTIVES, "RANDOM"],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateTorpedoContract(null)).toThrow(BluewaveError);
    expect(() => validateTorpedoContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-14/AC-24 (INC-5): the shipped torpedo detonation constant contract (MEDIUM-3)", () => {
  it("ships SHIPPED_TORPEDO_DETONATION_CONTRACT and validates without throwing", () => {
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.fullFunctionMinDepthM).toBe(3);
    expect(() =>
      validateTorpedoDetonationContract(SHIPPED_TORPEDO_DETONATION_CONTRACT),
    ).not.toThrow();
  });

  it("pins the exact INC-5 detonation constants in the contract", () => {
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.fuzePolicies).toEqual(["CONTACT", "MAGNETIC"]);
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.fuzeFunctionMultiplierBp).toEqual({
      CONTACT: 10_000,
      MAGNETIC: 9_000,
    });
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.targetProtectionLevels).toEqual([
      "NONE",
      "WEAK",
      "STANDARD",
      "STRONG",
      "ADVANCED",
    ]);
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.protectionFunctionMultiplierBp).toEqual({
      NONE: 10_000,
      WEAK: 9_500,
      STANDARD: 9_000,
      STRONG: 8_500,
      ADVANCED: 8_000,
    });
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.damageStateFunctionMultiplierBp).toEqual({
      CLEAN: 10_000,
      DAMAGED: 9_500,
    });
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.fullFunctionMaxDeviationMdeg).toBe(60_000);
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.modelFuzePolicy["ger_533mm_g7a_1934"]).toBe(
      "MAGNETIC",
    );
    expect(SHIPPED_TORPEDO_DETONATION_CONTRACT.modelFuzePolicy["whitehead_18in_1894"]).toBe(
      "CONTACT",
    );
  });

  it("fails closed on a tampered INC-5 detonation constant", () => {
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        fullFunctionMinDepthM: 2,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        fullFunctionMaxDeviationMdeg: 59_999,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        fuzeFunctionMultiplierBp: {
          ...SHIPPED_TORPEDO_DETONATION_CONTRACT.fuzeFunctionMultiplierBp,
          MAGNETIC: 9_001,
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        protectionFunctionMultiplierBp: {
          ...SHIPPED_TORPEDO_DETONATION_CONTRACT.protectionFunctionMultiplierBp,
          ADVANCED: 7_999,
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        damageStateFunctionMultiplierBp: {
          ...SHIPPED_TORPEDO_DETONATION_CONTRACT.damageStateFunctionMultiplierBp,
          DAMAGED: 9_499,
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        fuzePolicies: [...SHIPPED_TORPEDO_DETONATION_CONTRACT.fuzePolicies, "PI" as never],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered/missing/extra model->fuze mapping (no silent fuze default)", () => {
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        modelFuzePolicy: {},
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        modelFuzePolicy: {
          ...SHIPPED_TORPEDO_DETONATION_CONTRACT.modelFuzePolicy,
          ger_533mm_g7a_1934: "CONTACT",
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDetonationContract({
        ...SHIPPED_TORPEDO_DETONATION_CONTRACT,
        modelFuzePolicy: {
          ...SHIPPED_TORPEDO_DETONATION_CONTRACT.modelFuzePolicy,
          bogus_model: "CONTACT",
        },
      }),
    ).toThrow(BluewaveError);
    expect(() => validateTorpedoDetonationContract(null)).toThrow(BluewaveError);
    expect(() => validateTorpedoDetonationContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-24: exact shipped constant surface", () => {
  it("ships the closed §2 mount-type enum with exactly five values", () => {
    expect([...TORPEDO_MOUNT_TYPES]).toEqual([
      "ABOVE_WATER_FIXED",
      "ABOVE_WATER_TRAINABLE",
      "UNDERWATER_FIXED",
      "UNDERWATER_TRAINABLE",
      "SUBMARINE_INTERNAL",
    ]);
  });

  it("ships the exact §7 underwater-tube threshold (25 kn = 12_861_100 µm/s)", () => {
    expect(UNDERWATER_TUBE_MAX_SPEED_KNOTS).toBe(25);
    expect(UNDERWATER_TUBE_MAX_SPEED_UM_S).toBe(12_861_100);
    expect(torpedoSpeedBpKnotsToUmS(25_000)).toBe(12_861_100);
  });

  it("ships the exact §8 above-water defaults (fixed 30 kn / trainable 35 kn)", () => {
    expect(ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS).toBe(30);
    expect(ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS).toBe(35);
  });

  it("pins the §6 contact minimum, §10 solution minimums, and §6 sea-state ceiling in the contract", () => {
    expect(SHIPPED_TORPEDO_CONTRACT.targetContactMinimumBp).toBe(TORPEDO_TARGET_CONTACT_MINIMUM_BP);
    expect(SHIPPED_TORPEDO_CONTRACT.solutionMinimumBp).toEqual(TORPEDO_SOLUTION_MINIMUM_BP);
    expect(SHIPPED_TORPEDO_CONTRACT.maxLaunchSeaState).toBe(TORPEDO_MAX_LAUNCH_SEA_STATE);
  });

  it("resolvedAboveWaterMaxLaunchSpeedKnots applies defaults and a narrower declared value", () => {
    const fixed: TorpedoLauncherDefinition = {
      launcherFamilyId: "f",
      mountType: "ABOVE_WATER_FIXED",
      tubeCount: 2,
      boreDiameterMm: 533,
      handlingMassLimitKg: 1_600,
      supportedPropulsionTypes: ["WET_HEATER"],
      fireControlSupportedGuidance: ["gyro"],
      underwaterLaunchCapability: false,
      requiredReloadTimeMs: 120_000,
      aboveWaterMaxLaunchSpeedKnots: null,
    };
    const trainable = {
      ...fixed,
      launcherFamilyId: "t",
      mountType: "ABOVE_WATER_TRAINABLE" as const,
    };
    const narrower = { ...fixed, launcherFamilyId: "n", aboveWaterMaxLaunchSpeedKnots: 28 };
    const underwater = { ...fixed, launcherFamilyId: "u", mountType: "UNDERWATER_FIXED" as const };
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(fixed)).toBe(30);
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(trainable)).toBe(35);
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(narrower)).toBe(28);
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(underwater)).toBeNull(); // §7 governs
  });

  it("validateTorpedoLauncherDefinition rejects an invalid definition", () => {
    expect(() =>
      validateTorpedoLauncherDefinition({
        launcherFamilyId: "",
        mountType: "UNDERWATER_TRAINABLE",
        tubeCount: 4,
        boreDiameterMm: 533,
        handlingMassLimitKg: 1_600,
        supportedPropulsionTypes: ["WET_HEATER"],
        fireControlSupportedGuidance: ["gyro"],
        underwaterLaunchCapability: true,
        requiredReloadTimeMs: 120_000,
        aboveWaterMaxLaunchSpeedKnots: null,
      }),
    ).toThrow(BluewaveError);
  });

  it("ships the research-grounded torpedo_models_v1 model-id list (8 models, 1880-1945)", () => {
    expect(SHIPPED_TORPEDO_CONTRACT.shippedModelIds).toEqual(SEED_TORPEDO_MODEL_IDS);
    // The full research-grounded set (~6-8 models across 1880-1945,
    // docs/research/c1-m3-torpedoes.md §4.1) — the id list is now the fuselage of the
    // model->fuze map; the model DATA lives in the content parts (ticket 13b).
    expect(SEED_TORPEDO_MODEL_IDS.length).toBe(8);
    expect([...SEED_TORPEDO_MODEL_IDS]).toEqual([
      "whitehead_18in_1894",
      "rn_21in_mk_iv_1916",
      "ger_533mm_g7a_1934",
      "ger_533mm_g7e_1936",
      "jpn_61cm_type93_1935",
      "whitehead_14in_1886",
      "rn_21in_mk_viii_1927",
      "usn_21in_mk14_1931",
    ]);
  });

  it("speed conversion rejects non-integers and produces exact integers", () => {
    expect(torpedoSpeedBpKnotsToUmS(44_000)).toBe(22_635_536); // 44 kn (G7a high)
    expect(() => torpedoSpeedBpKnotsToUmS(44_000.5)).toThrow(BluewaveError);
    expect(() => torpedoSpeedBpKnotsToUmS(0)).toThrow(BluewaveError);
  });
});

describe("AC-24 (INC-8): the torpedo_launch_authority_v1 contract in the full *_v1 rollup (fail closed)", () => {
  it("ships the *_v1 policy id + SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT and validates", () => {
    expect(SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT.policyId).toBe("torpedo_launch_authority_v1");
    expect(() =>
      validateTorpedoLaunchAuthorityContract(SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on a tampered authority contract", () => {
    expect(() =>
      validateTorpedoLaunchAuthorityContract({
        ...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
        modes: [...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT.modes, "COMMODORE" as never],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoLaunchAuthorityContract({
        ...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
        manualLaunchProhibitedModes: [],
      }),
    ).toThrow(BluewaveError);
    expect(() => validateTorpedoLaunchAuthorityContract(null)).toThrow(BluewaveError);
  });
});

describe("AC-21 seeds: INC-1..INC-6 reason-code catalog shape", () => {
  it("ships exactly the INC-1 + INC-2 + INC-3 + INC-4 + INC-5 + INC-6 §29 codes — nothing more, nothing less (the INC-2 DEFERRED marker is retired)", () => {
    const shipped = Object.values(TORPEDO_REASON_CODES).sort();
    expect(shipped).toEqual(
      [
        "INVALID_TORPEDO_MODEL_DEFINITION",
        "INVALID_TORPEDO_LAUNCHER_STATE",
        "TORPEDO_MODEL_INCOMPATIBLE",
        "TORPEDO_AMMUNITION_UNAVAILABLE",
        "TORPEDO_STATE_INVARIANT_FAILED",
        "TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED",
        "TORPEDO_LAUNCH_AUTHORITY_DENIED",
        "TORPEDO_TARGET_CONTACT_INSUFFICIENT",
        "TORPEDO_FIRE_SOLUTION_INSUFFICIENT",
        "TORPEDO_LAUNCH_ARC_INVALID",
        "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING",
        "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED",
        "TORPEDO_FIRE_SOLUTION_FACTOR_MISSING",
        "TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED",
        "TORPEDO_LAUNCH_FAILURE",
        "TORPEDO_STUCK_IN_TUBE",
        "TORPEDO_HIT_RESOLVED",
        "TORPEDO_DUD",
        // INC-6 (damage package): the §16-§23 in-slice codes
        "TORPEDO_PROGRESSIVE_FLOODING_CREATED",
        "TORPEDO_MACHINERY_DAMAGE_CREATED",
        "TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED",
        "UNDERWATER_TUBE_SEVERE_FLOODING",
        "TORPEDO_CHAIN_REACTION",
      ].sort(),
    );
    // the retired marker is gone from the catalog and no longer a shipped code
    expect(Object.values(TORPEDO_REASON_CODES)).not.toContain(
      "TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED",
    );
  });

  it("every shipped code is a non-empty string literal (no duplicates)", () => {
    const values = Object.values(TORPEDO_REASON_CODES) as readonly string[];
    for (const code of values) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
    expect(new Set(values).size).toBe(values.length);
  });

  it("is disjoint from the top-level combat catalog (no redefinition)", () => {
    const torpedoSet = new Set(Object.values(TORPEDO_REASON_CODES) as readonly string[]);
    const sharedSet: ReadonlySet<string> = new Set(Object.values(REASON_CODES));
    for (const code of torpedoSet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("ships the INC-2 + INC-3 + INC-4 in-slice codes and does NOT ship §29 codes owned by other tracks", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(TORPEDO_REASON_CODES));
    // the INC-2 launch-legality codes + the INC-3 fire-solution/friendly-fire codes
    for (const code of [
      "TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED",
      "TORPEDO_LAUNCH_AUTHORITY_DENIED",
      "TORPEDO_TARGET_CONTACT_INSUFFICIENT",
      "TORPEDO_FIRE_SOLUTION_INSUFFICIENT",
      "TORPEDO_LAUNCH_ARC_INVALID",
      "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING",
      "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED",
      "TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED",
      "TORPEDO_FIRE_SOLUTION_FACTOR_MISSING",
    ]) {
      expect(shipped.has(code)).toBe(true);
    }
    // the retired INC-2 marker must NOT be shipped (its §24 family code now is)
    expect(shipped.has("TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED")).toBe(false);
    // the INC-4 §12 launch-failure codes ARE shipped (INC-4 resolved them)
    for (const code of ["TORPEDO_LAUNCH_FAILURE", "TORPEDO_STUCK_IN_TUBE"]) {
      expect(shipped.has(code)).toBe(true);
    }
    // the INC-5 §14/§15 codes ARE shipped (this increment resolved them)
    for (const code of ["TORPEDO_HIT_RESOLVED", "TORPEDO_DUD"]) {
      expect(shipped.has(code)).toBe(true);
    }
    // the §16-§23 damage codes ARE shipped — INC-6 (this increment) owns them
    for (const code of [
      "TORPEDO_PROGRESSIVE_FLOODING_CREATED",
      "TORPEDO_MACHINERY_DAMAGE_CREATED",
      "TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED",
      "UNDERWATER_TUBE_SEVERE_FLOODING",
      "TORPEDO_CHAIN_REACTION",
    ]) {
      expect(shipped.has(code)).toBe(true);
    }
    // every DESIGN-40 §29 in-slice code is now shipped; the remaining §29
    // ownership (submarine launch, aerial tubes, supply, command layer) is
    // OTHER-track code — none may be shipped here (INC-8's partition test).
    // and the INC-1 codes themselves are present
    expect(shipped.has("INVALID_TORPEDO_MODEL_DEFINITION")).toBe(true);
    expect(shipped.has(INVALID_TORPEDO_MODEL_DEFINITION)).toBe(true);
    expect(shipped.has("TORPEDO_STATE_INVARIANT_FAILED")).toBe(true);
    expect(TORPEDO_STATE_INVARIANT_FAILED).toBe("TORPEDO_STATE_INVARIANT_FAILED");
  });

  it("OXYGEN_RANGE_MULTIPLIER_BP pins the shipped §23 value", () => {
    expect(OXYGEN_RANGE_MULTIPLIER_BP).toBe(15_000);
  });
});

describe("AC-9/AC-11/AC-19 (INC-3): exact shipped §10/§11/§24 constant surface", () => {
  it("ships the exact §10 fire-solution manifest (10 factors, scale 10, floor, [0, 10_000])", () => {
    expect([...TORPEDO_SOLUTION_FACTOR_KEYS]).toEqual([
      "range",
      "bearing",
      "targetMotion",
      "ownManeuver",
      "crew",
      "training",
      "seaState",
      "visibility",
      "technology",
      "damage",
    ]);
    expect(TORPEDO_SOLUTION_SCALE_EXPONENT).toBe(10);
    expect(TORPEDO_SOLUTION_ROUNDING).toBe("floor");
    expect(TORPEDO_SOLUTION_FINAL_MIN_BP).toBe(0);
    expect(TORPEDO_SOLUTION_FINAL_MAX_BP).toBe(10_000);
    expect(TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP).toBe(7_500);
    expect(SHIPPED_TORPEDO_CONTRACT.solutionFactorKeys).toEqual(TORPEDO_SOLUTION_FACTOR_KEYS);
    expect(SHIPPED_TORPEDO_CONTRACT.friendlyDangerSectorMinimumBp).toBe(7_500);
  });

  it("ships the exact §24 friendly-fire geometry constants", () => {
    expect(TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M).toBe(1_000);
    expect(TORPEDO_DANGER_SECTOR_RAD_TO_MDEG).toBe(57_296);
    expect(TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP).toBe(4_000);
    expect(UNIDENTIFIED_CONTACT_IDENTITY).toBe("UNIDENTIFIED");
    expect(SHIPPED_TORPEDO_CONTRACT.friendlyFireMinSeparationM).toBe(1_000);
    expect(SHIPPED_TORPEDO_CONTRACT.dangerSectorRadToMdeg).toBe(57_296);
  });

  it("ships the exact §11 salvo policy surface (enums, base/withdrawal tables, weights, bands)", () => {
    expect([...TORPEDO_MISSION_OBJECTIVES]).toEqual([
      "ATTACK",
      "DEFENSE",
      "AREA_DENIAL",
      "BREAKTHROUGH",
    ]);
    expect(TORPEDO_SALVO_BASE_TUBES).toEqual({
      ATTACK: 2,
      DEFENSE: 1,
      AREA_DENIAL: 4,
      BREAKTHROUGH: 3,
    });
    expect(TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES).toEqual({ NORMAL: 0, WITHDRAWING: 1 });
    expect(TORPEDO_SALVO_FACTOR_WEIGHTS_BP).toEqual({
      targetCombatValue: 1_500,
      targetSize: 500,
      rangePressure: 1_000,
      solutionQualityDeficit: 1_000,
      ammoScarcity: 1_500,
      friendlyCoveragePressure: 1_000,
      overkill: 1_000,
    });
    expect(TORPEDO_SALVO_BP_PER_TUBE).toBe(1_000);
    expect(TORPEDO_SALVO_MIN_TUBES).toBe(1);
    expect(TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE[0]).toEqual({ maxRangeM: 2_000, pressureBp: 0 });
    expect(TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE[4]).toEqual({
      maxRangeM: Number.MAX_SAFE_INTEGER,
      pressureBp: 8_000,
    });
    expect(TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE[0]).toEqual({ minAmmo: 12, scarcityBp: 0 });
    expect(TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE[5]).toEqual({ minAmmo: 0, scarcityBp: 10_000 });
    expect(TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE[0]).toEqual({
      maxCount: 0,
      pressureBp: 10_000,
    });
    expect(SHIPPED_TORPEDO_CONTRACT.salvoBaseTubes).toEqual(TORPEDO_SALVO_BASE_TUBES);
    expect(SHIPPED_TORPEDO_CONTRACT.salvoBpPerTube).toBe(TORPEDO_SALVO_BP_PER_TUBE);
  });
});

describe("AC-15/AC-16/AC-17/AC-24 (INC-6): torpedo damage constant contract + guard", () => {
  it("ships SHIPPED_TORPEDO_DAMAGE_CONTRACT and validates without throwing", () => {
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.policyId).toBe("torpedo_damage_v1");
    expect(() => validateTorpedoDamageContract(SHIPPED_TORPEDO_DAMAGE_CONTRACT)).not.toThrow();
  });

  it("pins the exact shipped §17 flotation tables in the contract", () => {
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP).toEqual({
      NONE: 15_000,
      WEAK: 12_500,
      STANDARD: 10_000,
      STRONG: 7_500,
      ADVANCED: 5_000,
    });
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP).toEqual({
      EXTREMITY: 7_500,
      MACHINERY: 12_500,
      MAGAZINE: 12_500,
      TUBE_BAY: 12_500, // authored BALANCE TARGET (INC-6 record for ADR-0029)
      CENTRAL: 10_000,
      BREACHED: 15_000,
    });
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.protectionLeakMultiplierBp).toEqual(
      TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
    );
  });

  it("pins the exact shipped §18 isolation / §19 machinery / §20 shock surfaces", () => {
    expect(TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP).toEqual({
      INTACT: 5_000,
      DEGRADED: 10_000,
      FAILED: 15_000,
    });
    expect(TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP).toEqual({
      NO_EFFECT: 1_000,
      DEGRADED_PROPULSION: 4_000,
      MAJOR_PROPULSION_LOSS: 3_000,
      DEAD_IN_WATER: 1_500,
      CATASTROPHIC_MACHINERY_LOSS: 500,
    });
    expect(TORPEDO_NON_MACHINERY_ELIGIBILITY_BP).toBe(2_500);
  });

  it("fails closed on tampered INC-6 damage constants", () => {
    expect(() =>
      validateTorpedoDamageContract({
        ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
        flotationScaleExponent: 2,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDamageContract({
        ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
        protectionLeakMultiplierBp: { ...TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP, NONE: 14_999 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDamageContract({
        ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
        impactZoneFlotationMultiplierBp: {
          ...TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
          MAGAZINE: 12_499,
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDamageContract({
        ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
        floodingIsolationMultiplierBp: {
          ...TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP,
          FAILED: 14_999,
        },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoDamageContract({
        ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
        machinerySeverityWeightsBp: { ...TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP, NO_EFFECT: 999 },
      }),
    ).toThrow(BluewaveError);
    expect(() => validateTorpedoDamageContract(null)).toThrow(BluewaveError);
  });

  it("CONTRACT-PINS the highest-leverage authored constants (HIGH-1: base flotation + structural rates, severe-tube casualty base + share, immediate-flooding density + depth)", () => {
    // exact shipped values in the contract
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.baseFlotationDamagePerKgEq).toBe(16);
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.structuralDamagePerKgEq).toBe(48);
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.tubeCrewCasualtyBaseBp).toBe(5_000);
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.tubeCrewCasualtyShareBp).toBe(2_500);
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.seawaterDensityKgPerM3).toBe(1_000);
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.immediateFloodingMinDepthM).toBe(1);
    // the shipped constants match the contract (no drift)
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.baseFlotationDamagePerKgEq).toBe(
      TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ,
    );
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.structuralDamagePerKgEq).toBe(
      TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ,
    );
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.tubeCrewCasualtyBaseBp).toBe(
      TORPEDO_TUBE_CREW_CASUALTY_BASE_BP,
    );
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.tubeCrewCasualtyShareBp).toBe(
      TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP,
    );
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.seawaterDensityKgPerM3).toBe(
      TORPEDO_SEAWATER_DENSITY_KG_PER_M3,
    );
    expect(SHIPPED_TORPEDO_DAMAGE_CONTRACT.immediateFloodingMinDepthM).toBe(
      TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M,
    );
  });

  it("FAILS CLOSED when any CONTRACT-PINNED authored constant is tampered (HIGH-1)", () => {
    const tampered = {
      baseFlotationDamagePerKgEq: 17,
      structuralDamagePerKgEq: 47,
      tubeCrewCasualtyBaseBp: 5_001,
      tubeCrewCasualtyShareBp: 2_499,
      seawaterDensityKgPerM3: 999,
      immediateFloodingMinDepthM: 2,
    } as const;
    for (const [field, value] of Object.entries(tampered)) {
      expect(() =>
        validateTorpedoDamageContract({
          ...SHIPPED_TORPEDO_DAMAGE_CONTRACT,
          [field]: value,
        }),
      ).toThrow(BluewaveError);
    }
    // the intact contract still validates
    expect(() => validateTorpedoDamageContract(SHIPPED_TORPEDO_DAMAGE_CONTRACT)).not.toThrow();
  });
});

describe("AC-18/AC-24 (INC-6): the underwater_tube_hit_hazard_v1 name-branded contract + guard", () => {
  it("ships the spec-named hazard policy + exact §21 base and validates the contract", () => {
    expect(underwaterTubeHitHazardPolicyId).toBe("underwater_tube_hit_hazard_v1");
    expect(TORPEDO_TUBE_HAZARD_BASE_BP).toBe(5_000);
    expect(SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT.baseSevereFloodingBp).toBe(5_000);
    expect(SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT.loadedTubeMultiplierBp).toEqual({
      NO_LOADED_TORPEDO: 2_500,
      ONE_LOADED_TUBE: 10_000,
      TWO_OR_MORE_LOADED_TUBES: 12_500,
    });
    expect(() =>
      validateUnderwaterTubeHitHazardContract(SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on tampered §21 hazard constants", () => {
    expect(() =>
      validateUnderwaterTubeHitHazardContract({
        ...SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT,
        baseSevereFloodingBp: 4_999,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateUnderwaterTubeHitHazardContract({
        ...SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT,
        floodingIsolationMultiplierBp: { INTACT: 7_501, DEGRADED: 10_000, FAILED: 15_000 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateUnderwaterTubeHitHazardContract({
        ...SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT,
        protectionMultiplierBp: { NONE: 12_499, STANDARD: 10_000, IMPROVED: 7_500 },
      }),
    ).toThrow(BluewaveError);
    expect(() => validateUnderwaterTubeHitHazardContract(null)).toThrow(BluewaveError);
  });
});
