import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AttackType,
  ATTACK_TYPES,
  createAirDefenseAttack,
  validateAirDefenseAttack,
  INVALID_AIR_DEFENSE_ATTACK,
  type AirDefenseAttack,
} from "../../src/air-defense/index.js";

function validAttack(overrides: Record<string, unknown> = {}) {
  return createAirDefenseAttack({
    attackId: "atk_001",
    formationId: "frm_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(250),
    speedMps: SafeInt(129),
    currentRangeM: SafeInt(10_000),
    currentAltitudeM: SafeInt(3_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(5_000),
    releaseAltitudeM: SafeInt(2_000),
    isReleased: false,
    fireControlSolutionBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(60_000),
    formationSize: SafeInt(4),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
    contentHash: "b".repeat(64),
    ...overrides,
  });
}

describe("AirDefenseAttack", () => {
  describe("canonical attack types (§4)", () => {
    it("ATTACK_TYPES lists all 11 canonical types in §4 order", () => {
      expect(ATTACK_TYPES).toEqual([
        "AIRCRAFT_LEVEL_BOMBING",
        "AIRCRAFT_DIVE_BOMBING",
        "AIRCRAFT_SKIP_BOMBING",
        "AIRCRAFT_TORPEDO_ATTACK",
        "AIRCRAFT_ROCKET_ATTACK",
        "AIRCRAFT_GUIDED_WEAPON_ATTACK",
        "HEAVY_ASM",
        "MEDIUM_ASM",
        "LIGHT_ASM",
        "ANTI_RADIATION_WEAPON",
        "SPECIAL_EXPLICIT_ATTACK",
      ]);
    });

    it("AttackType exposes each canonical id", () => {
      expect(AttackType.HEAVY_ASM).toBe("HEAVY_ASM");
      expect(AttackType.SPECIAL_EXPLICIT_ATTACK).toBe("SPECIAL_EXPLICIT_ATTACK");
    });
  });

  describe("construction", () => {
    it("creates a valid attack and round-trips explicit SafeInt fields", () => {
      const attack = validAttack();
      expect(attack.attackId).toBe("atk_001");
      expect(attack.formationId).toBe("frm_001");
      expect(attack.targetId).toBe("ship_001");
      expect(attack.attackType).toBe(AttackType.AIRCRAFT_LEVEL_BOMBING);
      expect(Number(attack.speedKnots)).toBe(250);
      expect(Number(attack.currentRangeM)).toBe(10_000);
      expect(Number(attack.bearingDegrees)).toBe(0);
      expect(attack.isReleased).toBe(false);
      expect(Number(attack.fireControlSolutionBp)).toBe(10_000);
      expect(Number(attack.timeToImpactMs)).toBe(60_000);
      expect(Number(attack.formationSize)).toBe(4);
      expect(attack.contentVersion).toBe("air_defense_v1");
    });

    it("applies sensible SafeInt defaults for omitted fields", () => {
      const attack = createAirDefenseAttack({
        attackId: "atk_002",
        formationId: "frm_002",
        targetId: "ship_001",
        attackType: AttackType.AIRCRAFT_DIVE_BOMBING,
        contentHash: "c".repeat(64),
      });
      expect(Number(attack.currentRangeM)).toBe(0);
      expect(Number(attack.currentAltitudeM)).toBe(0);
      expect(Number(attack.bearingDegrees)).toBe(0);
      expect(Number(attack.releaseRangeM)).toBe(0);
      expect(Number(attack.releaseAltitudeM)).toBe(0);
      expect(attack.isReleased).toBe(false);
      expect(Number(attack.fireControlSolutionBp)).toBe(10_000);
      expect(Number(attack.timeToImpactMs)).toBe(120_000);
      expect(Number(attack.formationSize)).toBe(1);
      expect(Number(attack.cohesionBp)).toBe(10_000);
      expect(Number(attack.defensiveSusceptibilityBp)).toBe(10_000);
      expect(Number(attack.speedKnots)).toBe(0);
      expect(Number(attack.speedMps)).toBe(0);
    });
  });

  describe("fail-closed validation", () => {
    it("rejects unknown fields", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_003",
          formationId: "frm_003",
          targetId: "ship_001",
          unknownField: "should fail",
        } as unknown as Parameters<typeof createAirDefenseAttack>[0]);
      }).toThrow("AirDefenseAttack validation failed");
    });

    it("rejects an empty attackId (must be provided)", () => {
      expect(() => {
        createAirDefenseAttack({
          formationId: "frm_003",
          targetId: "ship_001",
        });
      }).toThrow("attackId must be a non-empty string");
    });

    it("rejects an empty targetId", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "",
        });
      }).toThrow("targetId must be a non-empty string");
    });

    it("rejects an empty formationId", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "",
          targetId: "ship_001",
        });
      }).toThrow("formationId must be a non-empty string");
    });

    it("rejects an invalid attackType", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "ship_001",
          // @ts-expect-error testing invalid attack type
          attackType: "NOT_A_TYPE",
        });
      }).toThrow();
    });

    it("rejects a non-safe-integer speedKnots", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "ship_001",
          speedKnots: 250.5 as unknown as SafeInt,
        });
      }).toThrow("speedKnots must be a non-negative integer");
    });

    it("rejects an unsafe integer for timeToImpactMs", () => {
      const UNSAFE = Number.MAX_SAFE_INTEGER + 1;
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "ship_001",
          timeToImpactMs: UNSAFE as unknown as SafeInt,
        });
      }).toThrow("timeToImpactMs must be a non-negative integer");
    });

    it("rejects zero formationSize (must be positive)", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "ship_001",
          formationSize: SafeInt(0),
        });
      }).toThrow("formationSize must be a positive integer");
    });

    it("rejects a wrong-length contentHash", () => {
      expect(() => {
        createAirDefenseAttack({
          attackId: "atk_004",
          formationId: "frm_003",
          targetId: "ship_001",
          contentHash: "short",
        });
      }).toThrow("contentHash must be a 64-character SHA-256 hex string");
    });
  });

  describe("bearing constraint (0..360)", () => {
    it("accepts bearing 0 and 360 (inclusive)", () => {
      expect(Number(validAttack({ bearingDegrees: SafeInt(0) }).bearingDegrees)).toBe(0);
      expect(Number(validAttack({ bearingDegrees: SafeInt(360) }).bearingDegrees)).toBe(360);
    });

    it("rejects bearing 361", () => {
      expect(() => validAttack({ bearingDegrees: SafeInt(361) })).toThrow(
        "bearingDegrees must be 0-360",
      );
    });

    it("rejects negative bearing", () => {
      expect(() => validAttack({ bearingDegrees: SafeInt(-1) })).toThrow(
        "bearingDegrees must be 0-360",
      );
    });
  });

  describe("validateAirDefenseAttack raw validation", () => {
    it("validates a correctly typed object with all required fields", () => {
      const raw = {
        attackId: "atk_005",
        formationId: "frm_005",
        targetId: "ship_001",
        attackType: "AIRCRAFT_ROCKET_ATTACK",
        speedKnots: 300,
        speedMps: 154,
        currentRangeM: 8_000,
        currentAltitudeM: 2_000,
        bearingDegrees: 45,
        releaseRangeM: 4_000,
        releaseAltitudeM: 1_000,
        isReleased: false,
        fireControlSolutionBp: 8_000,
        timeToImpactMs: 30_000,
        formationSize: 2,
        cohesionBp: 9_000,
        defensiveSusceptibilityBp: 8_000,
        contentVersion: "air_defense_v1",
        contentHash: "e".repeat(64),
      };
      const attack = validateAirDefenseAttack(raw);
      expect(attack.attackType).toBe("AIRCRAFT_ROCKET_ATTACK");
      expect(Number(attack.fireControlSolutionBp)).toBe(8_000);
    });

    it("throws BluewaveError with INVALID_AIR_DEFENSE_ATTACK on a bad object", () => {
      let caught: unknown;
      try {
        validateAirDefenseAttack({ attackId: 123 });
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_ATTACK);
    });

    it("createAirDefenseAttack throws BluewaveError with INVALID_AIR_DEFENSE_ATTACK", () => {
      let caught: unknown;
      try {
        createAirDefenseAttack({
          attackId: "atk_006",
          unknownField: "nope",
        } as unknown as Parameters<typeof createAirDefenseAttack>[0]);
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_ATTACK);
    });
  });
});

describe("AirDefenseAttack default-merging parity", () => {
  const required = {
    attackId: "atk_merge",
    formationId: "frm_merge",
    targetId: "ship_merge",
    contentHash: "f".repeat(64),
  };

  it("rejects empty input (required fields default to empty and fail)", () => {
    expect(() => createAirDefenseAttack({})).toThrow("attackId must be a non-empty string");
  });

  it("fails closed with a BluewaveError (not a raw TypeError) for an undefined input (12-F2)", () => {
    // @ts-expect-error 12-F2: deliberately violate the non-optional signature to prove the runtime guard.
    const call = () => createAirDefenseAttack(undefined);
    expect(call).toThrow(BluewaveError);
    expect(call).not.toThrow(TypeError);
  });

  it("applies defaults for partially supplied input", () => {
    const attack = createAirDefenseAttack(required);
    expect(Number(attack.speedKnots)).toBe(0);
    expect(Number(attack.formationSize)).toBe(1);
    expect(Number(attack.fireControlSolutionBp)).toBe(10_000);
    expect(attack.isReleased).toBe(false);
  });

  it("treats an explicit undefined as omitted and applies the default", () => {
    const attack = createAirDefenseAttack({ ...required, speedKnots: undefined });
    expect(Number(attack.speedKnots)).toBe(0);
  });

  it("rejects a supplied null instead of defaulting it (Zod .partial() parity)", () => {
    const params: Partial<AirDefenseAttack> = { ...required };
    (params as Record<string, unknown>).speedKnots = null;
    expect(() => createAirDefenseAttack(params)).toThrow(BluewaveError);
  });

  it("rejects missing required fields after default application", () => {
    expect(() =>
      createAirDefenseAttack({ formationId: "frm_merge", targetId: "ship_merge" }),
    ).toThrow("attackId must be a non-empty string");
  });

  it("reports every invalid supplied field in deterministic struct order", () => {
    const valid = {
      ...required,
      attackType: "HEAVY_ASM",
      speedKnots: 1,
      speedMps: 1,
      currentRangeM: 1,
      currentAltitudeM: 1,
      bearingDegrees: 0,
      releaseRangeM: 1,
      releaseAltitudeM: 1,
      isReleased: false,
      fireControlSolutionBp: 1,
      timeToImpactMs: 1,
      formationSize: 1,
      cohesionBp: 1,
      defensiveSusceptibilityBp: 1,
      contentVersion: "air_defense_v1",
    };
    let caught: unknown;
    try {
      validateAirDefenseAttack({ ...valid, speedKnots: -1, formationSize: 0 });
    } catch (error) {
      caught = error;
    }
    expect(isBluewaveError(caught)).toBe(true);
    const errors = (caught as BluewaveError).context.errors as ReadonlyArray<{
      path: string;
      message: string;
    }>;
    expect(errors.map((issue) => issue.path)).toEqual(["speedKnots", "formationSize"]);
    expect(errors[0].message).toBe("speedKnots must be a non-negative integer");
    expect(errors[1].message).toBe("formationSize must be a positive integer");
  });

  it("keeps the BluewaveError code on a default-merge failure", () => {
    let caught: unknown;
    try {
      createAirDefenseAttack({});
    } catch (error) {
      caught = error;
    }
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_ATTACK);
  });
});
