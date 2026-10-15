import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  CARRIER_STRIKE_EXCEEDS_SPOT_VALUE,
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
  OVERSIZED_CARRIER_THRESHOLD,
  STRIKE_COORDINATION_MODES,
  MISSION_STATES,
  FORMATION_STATES,
  type CarrierStrikeState,
  BASE_PREP_TIMES,
  STRIKE_TIME_MODIFIERS,
  COORDINATED_STRIKE_MODIFIERS,
  LAUNCH_RATES,
  basePrepMinutes,
  computeFinalStrikeTime,
  strikeTimeMultiplierFromCapacity,
  coordinatedFormationMinutes,
  coordinatedStrikeBp,
  spotLaunchCheck,
  assertSpotLaunchPermitted,
  effectiveLaunchRate,
  launchDurationMinutes,
  type LaunchRateInputs,
  validateCarrierStrikeStateContract,
  validateCarrierLaunchRateContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "../../src/carrier-operations/index.js";

function validStrikeState(overrides: Partial<CarrierStrikeState> = {}): CarrierStrikeState {
  return {
    strikeId: "strike_001",
    originCarrierIds: ["ship_cv_01"],
    targetReportId: "report_tg_01",
    targetConfidenceBp: 8_000,
    allocatedSquadrons: [
      { squadronId: "sqn_vf_1", aircraftModelId: "f4f_wildcat", count: SafeInt(12) },
    ],
    escortAllocationIds: ["sqn_vf_2"],
    loadoutId: "loadout_bomb",
    ordnanceReservations: [{ ordnanceTypeId: "bomb_500lb", quantity: SafeInt(12) }],
    coordinationMode: "UNCOORDINATED",
    readinessStartMinute: 0,
    plannedLaunchMinute: 20,
    actualLaunchMinute: 0,
    fuelRequirementBp: SafeInt(5_000),
    fuelReserveBp: SafeInt(1_000),
    spotValueRequirement: SafeInt(12),
    formationState: "FORMING",
    missionState: "PREPARING",
    recoveryPlan: {
      returnCarrierId: "ship_cv_01",
      recoveryWindowStart: 60,
      recoveryWindowEnd: 120,
      fuelReserveBp: SafeInt(500),
      divertFieldIds: ["field_01"],
    },
    rulesetVersion: "carrier_operations_ruleset_v1",
    strikeHash: "a".repeat(64),
    ...overrides,
  };
}

function defaultLaunchInputs(overrides: Partial<LaunchRateInputs> = {}): LaunchRateInputs {
  return {
    operationalCatapultCount: 0,
    usingSteamCatapults: false,
    isLightJet: false,
    isHeavyJet: false,
    isPiston: true,
    ...overrides,
  };
}

describe("AC-15: Strike state model", () => {
  it("constructs a valid CarrierStrikeState with all §13 fields", () => {
    const s = validStrikeState();
    expect(s.strikeId).toBe("strike_001");
    expect(s.originCarrierIds).toEqual(["ship_cv_01"]);
    expect(s.coordinationMode).toBe("UNCOORDINATED");
    expect(s.missionState).toBe("PREPARING");
    expect(s.formationState).toBe("FORMING");
    expect(Number(s.spotValueRequirement)).toBe(12);
    expect(s.strikeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("has the canonical coordination mode enum", () => {
    expect([...STRIKE_COORDINATION_MODES]).toEqual(["UNCOORDINATED", "COORDINATED"]);
  });

  it("has the canonical mission states", () => {
    expect([...MISSION_STATES]).toEqual([
      "PREPARING",
      "READY",
      "LAUNCHING",
      "AIRBORNE",
      "FORMING",
      "EN_ROUTE",
      "ON_TARGET",
      "RETURNING",
      "RECOVERING",
      "COMPLETED",
      "ABORTED",
      "LOST",
    ]);
  });

  it("has the canonical formation states", () => {
    expect([...FORMATION_STATES]).toEqual(["FORMING", "FORMED", "DISPERSED", "SCATTERED"]);
  });

  it("CarrierStrikeState_v1 validates a valid state", () => {
    expect(() => validateCarrierStrikeStateContract(validStrikeState())).not.toThrow();
  });

  it("CarrierStrikeState_v1 rejects missing strikeId", () => {
    expect(() => validateCarrierStrikeStateContract(validStrikeState({ strikeId: "" }))).toThrow();
  });
});

describe("AC-16: Base strike preparation times", () => {
  it("base prep times match §14 shipped values", () => {
    expect(BASE_PREP_TIMES.UNCOORDINATED).toBe(20);
    expect(BASE_PREP_TIMES.COORDINATED).toBe(30);
    expect(BASE_PREP_TIMES.ALERT_CAP).toBe(5);
    expect(BASE_PREP_TIMES.SEARCH).toBe(10);
    expect(BASE_PREP_TIMES.EMERGENCY_RE_STRIKE).toBe(10);
  });

  it("basePrepMinutes returns uncoordinated 20min", () => {
    expect(basePrepMinutes("UNCOORDINATED", false, false, false)).toBe(20);
  });

  it("basePrepMinutes returns coordinated 30min", () => {
    expect(basePrepMinutes("COORDINATED", false, false, false)).toBe(30);
  });

  it("basePrepMinutes returns alert CAP 5min", () => {
    expect(basePrepMinutes("UNCOORDINATED", true, false, false)).toBe(5);
  });

  it("basePrepMinutes returns search 10min", () => {
    expect(basePrepMinutes("UNCOORDINATED", false, true, false)).toBe(10);
  });

  it("basePrepMinutes returns emergency re-strike 10min", () => {
    expect(basePrepMinutes("UNCOORDINATED", false, false, true)).toBe(10);
  });
});

describe("AC-17: Strike-time modifiers", () => {
  it("shipped modifier constants match §15", () => {
    expect(STRIKE_TIME_MODIFIERS.IMPROVED_DECK_CREW_BP).toBe(9_000);
    expect(STRIKE_TIME_MODIFIERS.MODERN_DECK_CREW_BP).toBe(8_000);
    expect(STRIKE_TIME_MODIFIERS.COMPATIBLE_CATAPULT_BP).toBe(9_000);
    expect(STRIKE_TIME_MODIFIERS.ANGLED_DECK_BP).toBe(9_000);
    expect(STRIKE_TIME_MODIFIERS.DEGRADED_FLIGHT_DECK_BP).toBe(12_500);
    expect(STRIKE_TIME_MODIFIERS.HEAVY_PRECIPITATION_BP).toBe(15_000);
    expect(STRIKE_TIME_MODIFIERS.OVERSIZED_CARRIER_BP).toBe(11_000);
  });

  it("all neutral multipliers produce base time", () => {
    const result = computeFinalStrikeTime({
      baseMinutes: 20,
      deckCrewBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      catapultBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      deckConfigBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      damageBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      weatherBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      oversizedBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    });
    expect(result).toBe(20);
  });

  it("improved crew (9000bp) reduces time", () => {
    const neutral = computeFinalStrikeTime({
      baseMinutes: 20,
      deckCrewBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      catapultBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      deckConfigBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      damageBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      weatherBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      oversizedBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    });
    const improved = computeFinalStrikeTime({
      baseMinutes: 20,
      deckCrewBp: STRIKE_TIME_MODIFIERS.IMPROVED_DECK_CREW_BP,
      catapultBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      deckConfigBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      damageBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      weatherBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      oversizedBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    });
    expect(improved).toBe(neutral - 2);
  });

  it("degraded deck (12500bp) increases time", () => {
    const degraded = computeFinalStrikeTime({
      baseMinutes: 20,
      deckCrewBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      catapultBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      deckConfigBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      damageBp: STRIKE_TIME_MODIFIERS.DEGRADED_FLIGHT_DECK_BP,
      weatherBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      oversizedBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    });
    expect(degraded).toBe(25);
  });

  it("result is clamped to 5 minimum", () => {
    const result = computeFinalStrikeTime({
      baseMinutes: 5,
      deckCrewBp: STRIKE_TIME_MODIFIERS.MODERN_DECK_CREW_BP,
      catapultBp: STRIKE_TIME_MODIFIERS.COMPATIBLE_CATAPULT_BP,
      deckConfigBp: STRIKE_TIME_MODIFIERS.ANGLED_DECK_BP,
      damageBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      weatherBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      oversizedBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    });
    expect(result).toBeGreaterThanOrEqual(5);
  });

  it("result is clamped to 90 maximum", () => {
    const result = computeFinalStrikeTime({
      baseMinutes: 30,
      deckCrewBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      catapultBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      deckConfigBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
      damageBp: STRIKE_TIME_MODIFIERS.DEGRADED_FLIGHT_DECK_BP,
      weatherBp: STRIKE_TIME_MODIFIERS.HEAVY_PRECIPITATION_BP,
      oversizedBp: STRIKE_TIME_MODIFIERS.OVERSIZED_CARRIER_BP,
    });
    expect(result).toBeLessThanOrEqual(90);
  });

  it("strikeTimeMultiplierFromCapacity returns neutral for non-oversized", () => {
    expect(strikeTimeMultiplierFromCapacity(OVERSIZED_CARRIER_THRESHOLD)).toBe(
      CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    );
  });

  it("strikeTimeMultiplierFromCapacity returns oversized bp for >threshold", () => {
    expect(strikeTimeMultiplierFromCapacity(OVERSIZED_CARRIER_THRESHOLD + 1)).toBe(
      STRIKE_TIME_MODIFIERS.OVERSIZED_CARRIER_BP,
    );
  });
});

describe("AC-18: Coordinated strike effects", () => {
  it("shipped coordinated strike modifiers match §16", () => {
    expect(COORDINATED_STRIKE_MODIFIERS.ESCORT_COHESION_BP).toBe(12_000);
    expect(COORDINATED_STRIKE_MODIFIERS.STRIKE_COHESION_BP).toBe(12_000);
    expect(COORDINATED_STRIKE_MODIFIERS.MUTUAL_DEFENSE_BP).toBe(11_000);
    expect(COORDINATED_STRIKE_MODIFIERS.DISPERSION_BP).toBe(8_500);
    expect(COORDINATED_STRIKE_MODIFIERS.OPERATIONAL_LOSS_BP).toBe(9_000);
    expect(COORDINATED_STRIKE_MODIFIERS.COORDINATED_FORMATION_MINUTES).toBe(10);
    expect(COORDINATED_STRIKE_MODIFIERS.UNCOORDINATED_FORMATION_MINUTES).toBe(5);
  });

  it("coordinatedStrikeBp returns coordinated value when coordinated", () => {
    expect(coordinatedStrikeBp("ESCORT_COHESION_BP", true)).toBe(12_000);
  });

  it("coordinatedStrikeBp returns neutral when uncoordinated", () => {
    expect(coordinatedStrikeBp("ESCORT_COHESION_BP", false)).toBe(10_000);
  });

  it("coordinatedFormationMinutes returns 10 for coordinated", () => {
    expect(coordinatedFormationMinutes(true)).toBe(10);
  });

  it("coordinatedFormationMinutes returns 5 for uncoordinated", () => {
    expect(coordinatedFormationMinutes(false)).toBe(5);
  });
});

describe("AC-19: Spot-value launch limit", () => {
  it("passes when launch count <= spot value", () => {
    expect(spotLaunchCheck(12, SafeInt(12))).toBe(true);
    expect(spotLaunchCheck(10, SafeInt(12))).toBe(true);
  });

  it("fails when launch count > spot value", () => {
    expect(spotLaunchCheck(13, SafeInt(12))).toBe(false);
  });

  it("assertSpotLaunchPermitted does not throw when within limit", () => {
    expect(() => assertSpotLaunchPermitted(12, SafeInt(12))).not.toThrow();
  });

  it("assertSpotLaunchPermitted throws CARRIER_STRIKE_EXCEEDS_SPOT_VALUE when exceeded", () => {
    expect(() => assertSpotLaunchPermitted(13, SafeInt(12))).toThrow(
      CARRIER_STRIKE_EXCEEDS_SPOT_VALUE,
    );
  });
});

describe("AC-20: Launch rate", () => {
  it("shipped launch rates match §18", () => {
    expect(LAUNCH_RATES.NO_CATAPULT_PISTON).toBe(2);
    expect(LAUNCH_RATES.ONE_CATAPULT).toBe(3);
    expect(LAUNCH_RATES.TWO_PLUS_CATAPULTS).toBe(4);
    expect(LAUNCH_RATES.STEAM_LIGHT_JET).toBe(2);
    expect(LAUNCH_RATES.TWO_PLUS_STEAM).toBe(3);
    expect(LAUNCH_RATES.HEAVY_JET).toBe(2);
  });

  it("effectiveLaunchRate: no catapult piston = 2/min", () => {
    expect(effectiveLaunchRate(defaultLaunchInputs())).toBe(2);
  });

  it("effectiveLaunchRate: 1 catapult = 3/min", () => {
    expect(effectiveLaunchRate(defaultLaunchInputs({ operationalCatapultCount: 1 }))).toBe(3);
  });

  it("effectiveLaunchRate: 2+ catapults = 4/min", () => {
    expect(effectiveLaunchRate(defaultLaunchInputs({ operationalCatapultCount: 2 }))).toBe(4);
    expect(effectiveLaunchRate(defaultLaunchInputs({ operationalCatapultCount: 3 }))).toBe(4);
  });

  it("effectiveLaunchRate: steam + light jet = 2/min (1 steam)", () => {
    expect(
      effectiveLaunchRate(
        defaultLaunchInputs({
          operationalCatapultCount: 1,
          usingSteamCatapults: true,
          isLightJet: true,
          isPiston: false,
        }),
      ),
    ).toBe(2);
  });

  it("effectiveLaunchRate: 2+ steam + light jet = 3/min", () => {
    expect(
      effectiveLaunchRate(
        defaultLaunchInputs({
          operationalCatapultCount: 2,
          usingSteamCatapults: true,
          isLightJet: true,
          isPiston: false,
        }),
      ),
    ).toBe(3);
  });

  it("effectiveLaunchRate: heavy jet = 2/min", () => {
    expect(effectiveLaunchRate(defaultLaunchInputs({ isHeavyJet: true, isPiston: false }))).toBe(2);
  });

  it("launchDurationMinutes: ceil(aircraftCount / rate)", () => {
    expect(launchDurationMinutes(12, 2)).toBe(6);
    expect(launchDurationMinutes(12, 3)).toBe(4);
    expect(launchDurationMinutes(12, 4)).toBe(3);
    expect(launchDurationMinutes(1, 2)).toBe(1);
    expect(launchDurationMinutes(13, 4)).toBe(4);
  });

  it("CarrierLaunchRate_v1 validates a valid launch rate record", () => {
    const record = {
      operationalCatapultCount: 2,
      usingSteamCatapults: true,
      isLightJet: false,
      isHeavyJet: false,
      isPiston: true,
      effectiveRate: 4,
      durationMinutes: 3,
      aircraftCount: 12,
    };
    expect(() => validateCarrierLaunchRateContract(record)).not.toThrow();
  });

  it("CarrierLaunchRate_v1 rejects invalid catapult count", () => {
    const record = {
      operationalCatapultCount: -1,
      usingSteamCatapults: false,
      isLightJet: false,
      isHeavyJet: false,
      isPiston: true,
      effectiveRate: 2,
      durationMinutes: 6,
      aircraftCount: 12,
    };
    expect(() => validateCarrierLaunchRateContract(record)).toThrow();
  });
});

describe("INC-4 contract rollup", () => {
  it("includes the 2 new INC-4 contracts", () => {
    const ids = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((c) => c.policyId);
    expect(ids).toContain("carrier_strike_state_v1");
    expect(ids).toContain("carrier_launch_rate_v1");
  });
});
