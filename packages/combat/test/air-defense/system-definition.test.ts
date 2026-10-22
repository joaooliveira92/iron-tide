import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  createAirDefenseSystemDefinition,
  validateAirDefenseSystemDefinition,
  AirDefenseSystemDefinition,
  CategoryId,
  Layer,
  Category,
  INVALID_AIR_DEFENSE_SYSTEM_DEFINITION,
} from "@bluewave/combat/air-defense";

describe("AirDefenseSystemDefinition", () => {
  describe("valid system definitions", () => {
    it("should create a valid heavy AA system definition", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_001",
        layer: Layer.HEAVY_AA,
        category: Category.HEAVY_AA,
        mountCount: SafeInt(4),
        barrels: SafeInt(1),
        rangeMinM: SafeInt(0),
        rangeMaxM: SafeInt(20_000),
        altitudeMinM: SafeInt(0),
        altitudeMaxM: SafeInt(10_000),
        targetSpeedLimitMps: SafeInt(500),
        profileEligibility: new Set(["CA", "CV"]),
        fireControl: {
          trackingRangeM: SafeInt(25_000),
          maxElevationDegrees: SafeInt(85),
          updateRateHz: SafeInt(10),
        },
        radar: {
          frequencyBand: "S",
          peakPowerW: SafeInt(2_000),
          maxRangeM: SafeInt(30_000),
          resolutionDegrees: SafeInt(1),
        },
        engagementChannels: new Set(["ch001"]),
        baseKillBp: SafeInt(100),
        baseDamageBp: SafeInt(50),
        baseAbortBp: SafeInt(30),
        baseDisruptionBp: SafeInt(15),
        rate: SafeInt(100),
        saturationGroup: SafeInt(0),
        contentVersion: "air_defense_v1",
        contentHash: "a".repeat(64),
      });

      expect(system.systemId).toBe("sys_001");
      expect(system.layer).toBe("HEAVY_AA");
      expect(system.category).toBe("HEAVY_AA");
      expect(Number(system.mountCount)).toBe(4);
      expect(Number(system.rangeMaxM)).toBe(20_000);
      expect(system.profileEligibility.has("CA")).toBe(true);
      expect(system.engagementChannels.has("ch001")).toBe(true);
    });

    it("should create a valid light AA system definition", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_002",
        layer: Layer.LIGHT_AA,
        category: Category.LIGHT_AA,
        mountCount: SafeInt(12),
        barrels: SafeInt(2),
        rangeMinM: SafeInt(0),
        rangeMaxM: SafeInt(2_000),
        altitudeMinM: SafeInt(0),
        altitudeMaxM: SafeInt(8_000),
        targetSpeedLimitMps: SafeInt(300),
        profileEligibility: new Set(["CA", "DD", "SS"]),
        fireControl: {
          trackingRangeM: SafeInt(3_000),
          maxElevationDegrees: SafeInt(90),
          updateRateHz: SafeInt(20),
        },
        radar: {
          frequencyBand: "X",
          peakPowerW: SafeInt(500),
          maxRangeM: SafeInt(5_000),
          resolutionDegrees: SafeInt(2),
        },
        engagementChannels: new Set(["ch002", "ch003"]),
        baseKillBp: SafeInt(20),
        baseDamageBp: SafeInt(10),
        baseAbortBp: SafeInt(5),
        baseDisruptionBp: SafeInt(3),
        rate: SafeInt(200),
        saturationGroup: SafeInt(1),
        contentVersion: "air_defense_v1",
        contentHash: "b".repeat(64),
      });

      expect(system.layer).toBe("LIGHT_AA");
      expect(system.category).toBe("LIGHT_AA");
    });

    it("should create a valid CIWS system definition", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_003",
        layer: Layer.CIWS_TERMINAL_DEFENSE,
        category: Category.CIWS_TERMINAL_DEFENSE,
        mountCount: SafeInt(1),
        barrels: SafeInt(1),
        rangeMinM: SafeInt(0),
        rangeMaxM: SafeInt(1_500),
        altitudeMinM: SafeInt(0),
        altitudeMaxM: SafeInt(5_000),
        targetSpeedLimitMps: SafeInt(2_000),
        profileEligibility: new Set(["CA", "DD", "SS"]),
        fireControl: {
          trackingRangeM: SafeInt(2_000),
          maxElevationDegrees: SafeInt(90),
          updateRateHz: SafeInt(100),
        },
        radar: {
          frequencyBand: "Ka",
          peakPowerW: SafeInt(100),
          maxRangeM: SafeInt(3_000),
          resolutionDegrees: SafeInt(5),
        },
        engagementChannels: new Set(["ch004"]),
        baseKillBp: SafeInt(80),
        baseDamageBp: SafeInt(40),
        baseAbortBp: SafeInt(20),
        baseDisruptionBp: SafeInt(25),
        rate: SafeInt(4_000),
        saturationGroup: SafeInt(0),
        contentVersion: "air_defense_v1",
        contentHash: "c".repeat(64),
      });

      expect(system.layer).toBe("CIWS_TERMINAL_DEFENSE");
    });
  });

  describe("fail-closed validation - invalid system definitions", () => {
    it("should reject unknown fields", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          layer: Layer.HEAVY_AA,
          category: Category.HEAVY_AA,
          unknownField: "should fail",
        } as unknown as AirDefenseSystemDefinition);
      }).toThrow("AirDefenseSystemDefinition validation failed");
    });

    it("should reject invalid systemId (empty string)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "",
          layer: Layer.HEAVY_AA,
        });
      }).toThrow("systemId must be a non-empty string");
    });

    it("should reject invalid layer", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          // @ts-expect-error testing invalid layer
          layer: "INVALID_LAYER",
        });
      }).toThrow();
    });

    it("should reject invalid category", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          category: "INVALID_CATEGORY" as CategoryId,
        });
      }).toThrow();
    });

    it("should reject negative mountCount", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          mountCount: SafeInt(-1),
        });
      }).toThrow("mountCount must be a non-negative integer");
    });

    it("should reject zero barrels", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          barrels: SafeInt(0),
        });
      }).toThrow("barrels must be a positive integer");
    });

    it("should reject negative rangeMaxM", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          rangeMaxM: SafeInt(-1),
        });
      }).toThrow("rangeMaxM must be a positive integer");
    });

    it("should reject empty profileEligibility", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          profileEligibility: new Set(),
        });
      }).toThrow("profileEligibility must not be empty");
    });

    it("should reject empty engagementChannels", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          engagementChannels: new Set(),
        });
      }).toThrow("engagementChannels must not be empty");
    });

    it("should reject invalid fireControl trackElevationDegrees (> 90)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          fireControl: {
            trackingRangeM: SafeInt(10_000),
            maxElevationDegrees: SafeInt(100),
            updateRateHz: SafeInt(10),
          },
        });
      }).toThrow("maxElevationDegrees must be 0-90");
    });

    it("should reject invalid radar frequencyBand", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          radar: {
            frequencyBand: "INVALID",
            peakPowerW: SafeInt(1_000),
            maxRangeM: SafeInt(10_000),
            resolutionDegrees: SafeInt(1),
          } as unknown as NonNullable<
            Parameters<typeof createAirDefenseSystemDefinition>[0]
          >["radar"],
        });
      }).toThrow();
    });

    it("should reject invalid contentHash (wrong length)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          contentHash: "wrong",
        });
      }).toThrow("contentHash must be a 64-character SHA-256 hex string");
    });

    it("should reject invalid contentVersion (empty)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          contentVersion: "",
        });
      }).toThrow("contentVersion must be a non-empty string");
    });
  });

  describe("validateAirDefenseSystemDefinition raw validation", () => {
    it("should validate a correctly typed object with all required fields", () => {
      const raw = {
        systemId: "sys_001",
        layer: "HEAVY_AA",
        category: "HEAVY_AA",
        mountCount: 4,
        barrels: 1,
        rangeMinM: 0,
        rangeMaxM: 20_000,
        altitudeMinM: 0,
        altitudeMaxM: 10_000,
        targetSpeedLimitMps: 500,
        arcDegreesMax: 360,
        profileEligibility: new Set(["CA"]),
        fireControl: {
          trackingRangeM: 25_000,
          maxElevationDegrees: 85,
          updateRateHz: 10,
        },
        radar: {
          frequencyBand: "S",
          peakPowerW: 2_000,
          maxRangeM: 30_000,
          resolutionDegrees: 1,
        },
        engagementChannels: new Set(["ch001"]),
        baseKillBp: 100,
        baseDamageBp: 50,
        baseAbortBp: 30,
        baseDisruptionBp: 15,
        rate: 100,
        saturationGroup: 0,
        contentVersion: "air_defense_v1",
        contentHash: "a".repeat(64),
      };

      const result = validateAirDefenseSystemDefinition(raw);
      expect(result.systemId).toBe("sys_001");
    });

    it("should throw with detailed error for invalid object", () => {
      const raw = {
        systemId: 123,
        layer: "HEAVY_AA",
      };

      expect(() => validateAirDefenseSystemDefinition(raw)).toThrow(
        "AirDefenseSystemDefinition validation failed",
      );
    });
  });

  describe("all layer types", () => {
    it("should accept HEAVY_AA layer", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_heavy",
        layer: Layer.HEAVY_AA,
        category: Category.HEAVY_AA,
      });
      expect(system.layer).toBe("HEAVY_AA");
    });

    it("should accept MEDIUM_AA layer", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_medium",
        layer: Layer.MEDIUM_AA,
        category: Category.MEDIUM_AA,
      });
      expect(system.layer).toBe("MEDIUM_AA");
    });

    it("should accept LIGHT_AA layer", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_light",
        layer: Layer.LIGHT_AA,
        category: Category.LIGHT_AA,
      });
      expect(system.layer).toBe("LIGHT_AA");
    });

    it("should accept CIWS_TERMINAL_DEFENSE layer", () => {
      const system = createAirDefenseSystemDefinition({
        systemId: "sys_ciws",
        layer: Layer.CIWS_TERMINAL_DEFENSE,
        category: Category.CIWS_TERMINAL_DEFENSE,
      });
      expect(system.layer).toBe("CIWS_TERMINAL_DEFENSE");
    });
  });

  describe("safe-integer validation parity", () => {
    const UNSAFE = Number.MAX_SAFE_INTEGER + 1;

    it("should reject an unsafe integer for baseKillBp", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_safe",
          baseKillBp: UNSAFE as unknown as SafeInt,
        });
      }).toThrow("baseKillBp must be a non-negative integer");
    });

    it("should reject an unsafe integer for baseDamageBp (another of the six fields)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_safe",
          baseDamageBp: UNSAFE as unknown as SafeInt,
        });
      }).toThrow("baseDamageBp must be a non-negative integer");
    });

    it("should reject an unsafe integer for mountCount (pre-existing safeIntSchema parity)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_safe",
          mountCount: UNSAFE as unknown as SafeInt,
        });
      }).toThrow("mountCount must be a non-negative integer");
    });

    it("should reject an unsafe integer for rate (positive field)", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_safe",
          rate: UNSAFE as unknown as SafeInt,
        });
      }).toThrow("rate must be a positive integer");
    });
  });

  describe("nested fail-closed validation", () => {
    it("should reject unknown nested fields in fireControl", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          fireControl: {
            trackingRangeM: SafeInt(10_000),
            maxElevationDegrees: SafeInt(85),
            updateRateHz: SafeInt(10),
            unexpected: "should fail",
          } as unknown as NonNullable<
            Parameters<typeof createAirDefenseSystemDefinition>[0]
          >["fireControl"],
        });
      }).toThrow("AirDefenseSystemDefinition validation failed");
    });

    it("should reject unknown nested fields in radar", () => {
      expect(() => {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          radar: {
            frequencyBand: "S",
            peakPowerW: SafeInt(1_000),
            maxRangeM: SafeInt(10_000),
            resolutionDegrees: SafeInt(1),
            unexpected: "should fail",
          } as unknown as NonNullable<
            Parameters<typeof createAirDefenseSystemDefinition>[0]
          >["radar"],
        });
      }).toThrow("AirDefenseSystemDefinition validation failed");
    });
  });

  describe("BluewaveError reason code", () => {
    it("validateAirDefenseSystemDefinition should throw BluewaveError with INVALID_AIR_DEFENSE_SYSTEM_DEFINITION", () => {
      let caught: unknown;
      try {
        validateAirDefenseSystemDefinition({ systemId: 123 });
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      const err = caught as BluewaveError;
      expect(err.context.code).toBe(INVALID_AIR_DEFENSE_SYSTEM_DEFINITION);
    });

    it("createAirDefenseSystemDefinition should throw BluewaveError with INVALID_AIR_DEFENSE_SYSTEM_DEFINITION", () => {
      let caught: unknown;
      try {
        createAirDefenseSystemDefinition({
          systemId: "sys_001",
          unknownField: "should fail",
        } as unknown as AirDefenseSystemDefinition);
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      const err = caught as BluewaveError;
      expect(err.context.code).toBe(INVALID_AIR_DEFENSE_SYSTEM_DEFINITION);
    });
  });
});

describe("AirDefenseSystemDefinition default-merging parity", () => {
  it("rejects empty input (systemId defaults to empty and fails)", () => {
    expect(() => createAirDefenseSystemDefinition({})).toThrow(
      "systemId must be a non-empty string",
    );
  });

  it("fails closed with a BluewaveError (not a raw TypeError) for an undefined input (12-F2)", () => {
    // @ts-expect-error 12-F2: deliberately violate the non-optional signature to prove the runtime guard.
    const call = () => createAirDefenseSystemDefinition(undefined);
    expect(call).toThrow(BluewaveError);
    expect(call).not.toThrow(TypeError);
  });

  it("applies defaults for partially supplied input", () => {
    const system = createAirDefenseSystemDefinition({ systemId: "sys_merge" });
    expect(system.layer).toBe("HEAVY_AA");
    expect(system.category).toBe("HEAVY_AA");
    expect(Number(system.mountCount)).toBe(0);
    expect(Number(system.barrels)).toBe(1);
    expect(system.localControlSupported).toBe(false);
    expect(system.profileEligibility.has("DEFAULT")).toBe(true);
    expect(system.engagementChannels.has("default")).toBe(true);
  });

  it("treats an explicit undefined as omitted and applies the default", () => {
    const system = createAirDefenseSystemDefinition({ systemId: "sys_merge", layer: undefined });
    expect(system.layer).toBe("HEAVY_AA");
  });

  it("rejects a supplied null instead of defaulting it (Zod .partial() parity)", () => {
    const params: Partial<AirDefenseSystemDefinition> = { systemId: "sys_merge" };
    (params as Record<string, unknown>).mountCount = null;
    expect(() => createAirDefenseSystemDefinition(params)).toThrow(BluewaveError);
  });

  it("rejects missing required fields after default application", () => {
    expect(() => createAirDefenseSystemDefinition({ layer: Layer.HEAVY_AA })).toThrow(
      "systemId must be a non-empty string",
    );
  });

  it("reports every invalid supplied field in deterministic struct order", () => {
    const valid = {
      systemId: "sys_merge",
      layer: "HEAVY_AA",
      category: "HEAVY_AA",
      mountCount: 0,
      barrels: 1,
      rangeMinM: 0,
      rangeMaxM: 1,
      altitudeMinM: 0,
      altitudeMaxM: 1,
      targetSpeedLimitMps: 1,
      arcDegreesMax: 0,
      profileEligibility: new Set(["CA"]),
      fireControl: { trackingRangeM: 1, maxElevationDegrees: 0, updateRateHz: 1 },
      radar: { frequencyBand: "S", peakPowerW: 1, maxRangeM: 1, resolutionDegrees: 1 },
      engagementChannels: new Set(["ch"]),
      contentVersion: "air_defense_v1",
      contentHash: "a".repeat(64),
    };
    let caught: unknown;
    try {
      validateAirDefenseSystemDefinition({ ...valid, mountCount: -1, barrels: 0 });
    } catch (error) {
      caught = error;
    }
    expect(isBluewaveError(caught)).toBe(true);
    const errors = (caught as BluewaveError).context.errors as ReadonlyArray<{
      path: string;
      message: string;
    }>;
    expect(errors.map((issue) => issue.path)).toEqual(["mountCount", "barrels"]);
    expect(errors[0].message).toBe("mountCount must be a non-negative integer");
    expect(errors[1].message).toBe("barrels must be a positive integer");
  });
});

describe("AirDefenseSystemDefinition Set semantics", () => {
  const base = { systemId: "sys_set" };

  it("accepts a non-empty Set", () => {
    const system = createAirDefenseSystemDefinition({
      ...base,
      profileEligibility: new Set(["CA"]),
    });
    expect(system.profileEligibility.size).toBe(1);
  });

  it("rejects an empty Set", () => {
    expect(() =>
      createAirDefenseSystemDefinition({ ...base, profileEligibility: new Set() }),
    ).toThrow("profileEligibility must not be empty");
    expect(() =>
      createAirDefenseSystemDefinition({ ...base, engagementChannels: new Set() }),
    ).toThrow("engagementChannels must not be empty");
  });

  it("rejects an invalid member", () => {
    const params: Partial<AirDefenseSystemDefinition> = { ...base };
    (params as Record<string, unknown>).profileEligibility = new Set([1]);
    expect(() => createAirDefenseSystemDefinition(params)).toThrow(BluewaveError);
  });

  it("decodes to a runtime Set (not merely a ReadonlySet type)", () => {
    const system = createAirDefenseSystemDefinition({
      ...base,
      profileEligibility: new Set(["CA"]),
    });
    expect(system.profileEligibility).toBeInstanceOf(Set);
    expect(system.engagementChannels).toBeInstanceOf(Set);
  });

  it("clones the input Set rather than sharing its identity", () => {
    const input = new Set(["CA", "CV"]);
    const system = createAirDefenseSystemDefinition({ ...base, profileEligibility: input });
    expect(system.profileEligibility).not.toBe(input);
    expect([...system.profileEligibility]).toEqual(["CA", "CV"]);
  });

  it("is unaffected by later mutation of the input Set", () => {
    const input = new Set(["CA"]);
    const system = createAirDefenseSystemDefinition({ ...base, profileEligibility: input });
    input.add("CV");
    expect([...system.profileEligibility]).toEqual(["CA"]);
  });

  it("collapses duplicate members (Set semantics)", () => {
    const system = createAirDefenseSystemDefinition({
      ...base,
      profileEligibility: new Set(["CA", "CA", "CV"]),
    });
    expect([...system.profileEligibility]).toEqual(["CA", "CV"]);
    expect(system.profileEligibility.size).toBe(2);
  });

  it("preserves insertion/iteration order", () => {
    const system = createAirDefenseSystemDefinition({
      ...base,
      engagementChannels: new Set(["b", "a", "c"]),
    });
    expect([...system.engagementChannels]).toEqual(["b", "a", "c"]);
  });
});
