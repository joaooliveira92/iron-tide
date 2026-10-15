import { describe, expect, it } from "vite-plus/test";
import {
  WOD_PISTON_LAUNCH_MIN_KNOTS,
  WOD_PISTON_RECOVERY_MIN_KNOTS,
  WOD_LIGHT_JET_LAUNCH_MIN_KNOTS,
  WOD_LIGHT_JET_RECOVERY_MIN_KNOTS,
  WOD_HEAVY_JET_LAUNCH_MIN_KNOTS,
  WOD_HEAVY_JET_RECOVERY_MIN_KNOTS,
  WOD_HELICOPTER_DEFAULT_MIN_KNOTS,
  CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION,
  CARRIER_WIND_OVER_DECK_INSUFFICIENT,
  type AircraftClass,
  type WindVector,
  relativeWindOverDeckKnots,
  assertManeuverNotLocked,
  minimumWindOverDeckForLaunch,
  minimumWindOverDeckForRecovery,
  checkWindOverDeckSufficient,
  assertWindOverDeckSufficient,
  validateCarrierWindOverDeckContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "../../src/carrier-operations/index.js";

function headwindWindVector(overrides: Partial<WindVector> = {}): WindVector {
  return {
    ambientWindSpeedKnots: 10,
    ambientWindDirectionDegrees: 0,
    carrierSpeedKnots: 15,
    carrierCourseDegrees: 0,
    ...overrides,
  };
}

describe("AC-21: Automatic carrier maneuver", () => {
  describe("relativeWindOverDeckKnots", () => {
    it("headwind: carrier speed + ambient = 25kt", () => {
      const wod = relativeWindOverDeckKnots(headwindWindVector());
      expect(wod).toBe(25);
    });

    it("tailwind: carrier speed - ambient = 5kt", () => {
      const wod = relativeWindOverDeckKnots(
        headwindWindVector({ ambientWindDirectionDegrees: 180 }),
      );
      expect(wod).toBe(5);
    });

    it("crosswind: sqrt-based, 90deg: carrier speed (cos90=0)", () => {
      const wod = relativeWindOverDeckKnots(
        headwindWindVector({ ambientWindDirectionDegrees: 90 }),
      );
      expect(wod).toBe(15);
    });

    it("270deg crosswind is same as 90deg", () => {
      const wod = relativeWindOverDeckKnots(
        headwindWindVector({ ambientWindDirectionDegrees: 270 }),
      );
      expect(wod).toBe(15);
    });
  });

  describe("assertManeuverNotLocked", () => {
    it("does not throw when no current operation", () => {
      expect(() => assertManeuverNotLocked(undefined, "op_001")).not.toThrow();
    });

    it("does not throw when same operation id", () => {
      expect(() => assertManeuverNotLocked("op_001", "op_001")).not.toThrow();
    });

    it("throws CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION for conflicting operation", () => {
      expect(() => assertManeuverNotLocked("op_001", "op_002")).toThrow(
        CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION,
      );
    });
  });
});

describe("AC-22: Wind-over-deck requirements", () => {
  it("shipped WOD minimums match §20", () => {
    expect(WOD_PISTON_LAUNCH_MIN_KNOTS).toBe(20);
    expect(WOD_PISTON_RECOVERY_MIN_KNOTS).toBe(18);
    expect(WOD_LIGHT_JET_LAUNCH_MIN_KNOTS).toBe(25);
    expect(WOD_LIGHT_JET_RECOVERY_MIN_KNOTS).toBe(22);
    expect(WOD_HEAVY_JET_LAUNCH_MIN_KNOTS).toBe(30);
    expect(WOD_HEAVY_JET_RECOVERY_MIN_KNOTS).toBe(25);
    expect(WOD_HELICOPTER_DEFAULT_MIN_KNOTS).toBe(0);
  });

  it("minimumWindOverDeckForLaunch: piston = 20kt", () => {
    expect(minimumWindOverDeckForLaunch("PISTON")).toBe(20);
  });

  it("minimumWindOverDeckForLaunch: light jet = 25kt", () => {
    expect(minimumWindOverDeckForLaunch("LIGHT_JET")).toBe(25);
  });

  it("minimumWindOverDeckForLaunch: heavy jet = 30kt", () => {
    expect(minimumWindOverDeckForLaunch("HEAVY_JET")).toBe(30);
  });

  it("minimumWindOverDeckForLaunch: helo = 0kt", () => {
    expect(minimumWindOverDeckForLaunch("HELICOPTER")).toBe(0);
  });

  it("minimumWindOverDeckForRecovery: piston = 18kt", () => {
    expect(minimumWindOverDeckForRecovery("PISTON")).toBe(18);
  });

  it("minimumWindOverDeckForRecovery: light jet = 22kt", () => {
    expect(minimumWindOverDeckForRecovery("LIGHT_JET")).toBe(22);
  });

  it("minimumWindOverDeckForRecovery: heavy jet = 25kt", () => {
    expect(minimumWindOverDeckForRecovery("HEAVY_JET")).toBe(25);
  });

  it("minimumWindOverDeckForRecovery: helo = 0kt", () => {
    expect(minimumWindOverDeckForRecovery("HELICOPTER")).toBe(0);
  });

  it("checkWindOverDeckSufficient: piston launch at 20kt passes", () => {
    expect(checkWindOverDeckSufficient(20, "PISTON", true)).toBe(true);
  });

  it("checkWindOverDeckSufficient: piston launch at 19kt fails", () => {
    expect(checkWindOverDeckSufficient(19, "PISTON", true)).toBe(false);
  });

  it("checkWindOverDeckSufficient: piston recovery at 18kt passes", () => {
    expect(checkWindOverDeckSufficient(18, "PISTON", true)).toBe(false);
    expect(checkWindOverDeckSufficient(18, "PISTON", false)).toBe(true);
  });

  it("checkWindOverDeckSufficient: heavy jet launch at 30kt passes", () => {
    expect(checkWindOverDeckSufficient(30, "HEAVY_JET", true)).toBe(true);
  });

  it("checkWindOverDeckSufficient: heavy jet launch at 29kt fails", () => {
    expect(checkWindOverDeckSufficient(29, "HEAVY_JET", true)).toBe(false);
  });

  it("assertWindOverDeckSufficient throws for insufficient WOD", () => {
    expect(() => assertWindOverDeckSufficient(19, "PISTON", true, "piston launch")).toThrow(
      CARRIER_WIND_OVER_DECK_INSUFFICIENT,
    );
  });

  it("assertWindOverDeckSufficient does not throw for sufficient WOD", () => {
    expect(() => assertWindOverDeckSufficient(20, "PISTON", true, "piston launch")).not.toThrow();
  });
});

describe("INC-5 contracts", () => {
  it("CarrierWindOverDeck_v1 validates a valid record", () => {
    const record = {
      requiredCourse: { minDegrees: 0, maxDegrees: 10 },
      requiredSpeed: { minKnots: 20, maxKnots: 25 },
      windVector: {
        ambientWindSpeedKnots: 10,
        ambientWindDirectionDegrees: 0,
        carrierSpeedKnots: 15,
        carrierCourseDegrees: 0,
      },
      deckOperationId: "op_001",
      relativeWodKnots: 25,
      aircraftClass: "PISTON" as AircraftClass,
      isLaunch: true,
      wodSufficient: true,
    };
    expect(() => validateCarrierWindOverDeckContract(record)).not.toThrow();
  });

  it("includes carrier_wind_over_deck_v1 in contract rollup", () => {
    const ids = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((c) => c.policyId);
    expect(ids).toContain("carrier_wind_over_deck_v1");
  });
});
