import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  HAZARD_WEIGHTS,
  BASE_HAZARD_PROBABILITIES,
  NIGHT_RECOVERY_LOSS_BASES,
  NIGHT_RECOVERY_FAILURE_RESULTS,
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
  CARRIER_NIGHT_RECOVERY_INELIGIBLE,
  CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
  type HazardExposureInputs,
  type HazardProbabilityInputs,
  type NightRecoveryPredicates,
  type WeatherSuspensionPredicates,
  type WeatherSuspensionResult,
  computeHazardExposure,
  computeFinalHazardProbability,
  isNightRecoveryEligible,
  assertNightRecoveryEligible,
  selectNightRecoveryLossResult,
  evaluateWeatherSuspension,
  validateCarrierHazardExposureContract,
  validateCarrierNightRecoveryContract,
  validateCarrierWeatherSuspensionContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "../../src/carrier-operations/index.js";

function defaultHazardInputs(overrides: Partial<HazardExposureInputs> = {}): HazardExposureInputs {
  return {
    fueledAircraftCount: SafeInt(10),
    armedAircraftCount: SafeInt(8),
    torpedoLoadedAircraftCount: SafeInt(0),
    guidedWeaponLoadedAircraftCount: SafeInt(0),
    fuelingTransferActive: false,
    ordnanceHandlingActive: false,
    ...overrides,
  };
}

function defaultProbInputs(
  overrides: Partial<HazardProbabilityInputs> = {},
): HazardProbabilityInputs {
  return {
    baseProbabilityBp: 2_000,
    exposureMultiplierBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    damageMultiplierBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    firefightingMultiplierBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    deckConfigurationMultiplierBp: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    ...overrides,
  };
}

describe("AC-23: Fueled/armed deck hazard exposure", () => {
  it("shipped weights match §21", () => {
    expect(HAZARD_WEIGHTS.FUELED_AIRCRAFT).toBe(10);
    expect(HAZARD_WEIGHTS.ARMED_AIRCRAFT).toBe(10);
    expect(HAZARD_WEIGHTS.TORPEDO_LOADED_AIRCRAFT).toBe(15);
    expect(HAZARD_WEIGHTS.GUIDED_WEAPON_LOADED_AIRCRAFT).toBe(20);
    expect(HAZARD_WEIGHTS.ACTIVE_FUELING_TRANSFER).toBe(100);
    expect(HAZARD_WEIGHTS.ACTIVE_ORDNANCE_HANDLING).toBe(100);
  });

  it("computeHazardExposure: 10 fueled + 8 armed = 180", () => {
    const result = computeHazardExposure(defaultHazardInputs());
    expect(Number(result)).toBe(180);
  });

  it("computeHazardExposure: includes torpedo weight", () => {
    const result = computeHazardExposure(
      defaultHazardInputs({ torpedoLoadedAircraftCount: SafeInt(4) }),
    );
    expect(Number(result)).toBe(180 + 4 * 15);
  });

  it("computeHazardExposure: includes active fueling", () => {
    const result = computeHazardExposure(defaultHazardInputs({ fuelingTransferActive: true }));
    expect(Number(result)).toBe(180 + 100);
  });

  it("computeHazardExposure: includes ordnance handling", () => {
    const result = computeHazardExposure(defaultHazardInputs({ ordnanceHandlingActive: true }));
    expect(Number(result)).toBe(180 + 100);
  });

  it("computeHazardExposure: zero aircraft produces zero exposure", () => {
    const result = computeHazardExposure(
      defaultHazardInputs({ fueledAircraftCount: SafeInt(0), armedAircraftCount: SafeInt(0) }),
    );
    expect(Number(result)).toBe(0);
  });
});

describe("AC-24: Aviation fire/explosion probabilities", () => {
  it("base conditional probabilities match §22", () => {
    expect(BASE_HAZARD_PROBABILITIES.FUELED_AIRCRAFT_IGNITION).toBe(2_000);
    expect(BASE_HAZARD_PROBABILITIES.ARMED_AIRCRAFT_ORDNANCE_REACTION).toBe(1_500);
    expect(BASE_HAZARD_PROBABILITIES.TORPEDO_WARHEAD_REACTION).toBe(2_500);
    expect(BASE_HAZARD_PROBABILITIES.MISSILE_OR_GUIDED_REACTION).toBe(2_000);
    expect(BASE_HAZARD_PROBABILITIES.HANGAR_FUEL_PROPAGATION).toBe(2_500);
    expect(BASE_HAZARD_PROBABILITIES.ACTIVE_FUELING_PROPAGATION).toBe(5_000);
  });

  it("all neutral multipliers return base probability", () => {
    const result = computeFinalHazardProbability(defaultProbInputs());
    expect(result).toBe(2_000);
  });

  it("clamp: never below 0", () => {
    const result = computeFinalHazardProbability(defaultProbInputs({ baseProbabilityBp: 0 }));
    expect(result).toBe(0);
  });

  it("clamp: never above 10_000", () => {
    const result = computeFinalHazardProbability(
      defaultProbInputs({ baseProbabilityBp: 10_000, exposureMultiplierBp: 15_000 }),
    );
    expect(result).toBeLessThanOrEqual(10_000);
  });

  it("exposure multiplier increases probability", () => {
    const base = computeFinalHazardProbability(defaultProbInputs());
    const increased = computeFinalHazardProbability(
      defaultProbInputs({ exposureMultiplierBp: 15_000 }),
    );
    expect(increased).toBeGreaterThanOrEqual(base);
  });
});

describe("AC-25: Night recovery eligibility", () => {
  function eligiblePreds(
    overrides: Partial<NightRecoveryPredicates> = {},
  ): NightRecoveryPredicates {
    return {
      hasNightCarrierOperationsTech: true,
      hasOperationalDeckLighting: true,
      hasValidContact: true,
      windOverDeckKnots: 20,
      aircraftClass: "PISTON",
      weatherNotSuspended: true,
      carrierCommandAccepts: true,
      hasSufficientFuel: true,
      isEmergency: false,
      ...overrides,
    };
  }

  it("all predicates met = eligible", () => {
    expect(isNightRecoveryEligible(eligiblePreds())).toBe(true);
  });

  it("no tech + no emergency = ineligible", () => {
    expect(isNightRecoveryEligible(eligiblePreds({ hasNightCarrierOperationsTech: false }))).toBe(
      false,
    );
  });

  it("no tech + emergency = eligible", () => {
    expect(
      isNightRecoveryEligible(
        eligiblePreds({ hasNightCarrierOperationsTech: false, isEmergency: true }),
      ),
    ).toBe(true);
  });

  it("no deck lighting = ineligible", () => {
    expect(isNightRecoveryEligible(eligiblePreds({ hasOperationalDeckLighting: false }))).toBe(
      false,
    );
  });

  it("invalid contact = ineligible", () => {
    expect(isNightRecoveryEligible(eligiblePreds({ hasValidContact: false }))).toBe(false);
  });

  it("weather suspended = ineligible", () => {
    expect(isNightRecoveryEligible(eligiblePreds({ weatherNotSuspended: false }))).toBe(false);
  });

  it("assertNightRecoveryEligible throws when ineligible", () => {
    expect(() =>
      assertNightRecoveryEligible(eligiblePreds({ hasNightCarrierOperationsTech: false })),
    ).toThrow(CARRIER_NIGHT_RECOVERY_INELIGIBLE);
  });
});

describe("AC-26: Night recovery loss risk", () => {
  it("loss bases match §24", () => {
    expect(NIGHT_RECOVERY_LOSS_BASES.DAYLIGHT).toBe(250);
    expect(NIGHT_RECOVERY_LOSS_BASES.TWILIGHT).toBe(750);
    expect(NIGHT_RECOVERY_LOSS_BASES.TRAINED_NIGHT).toBe(2_500);
    expect(NIGHT_RECOVERY_LOSS_BASES.EMERGENCY).toBe(7_500);
  });

  it("failure results have 6 canonical values", () => {
    expect([...NIGHT_RECOVERY_FAILURE_RESULTS]).toEqual([
      "BOLTER_OR_WAVE_OFF",
      "RECOVERABLE_DECK_ACCIDENT",
      "AIRCRAFT_LOST_OVERBOARD",
      "COLLISION_WITH_PARKED_AIRCRAFT",
      "SEVERE_DECK_CRASH",
      "PILOT_AND_AIRCRAFT_LOSS",
    ]);
  });

  it("selectNightRecoveryLossResult: low roll = bolter", () => {
    expect(selectNightRecoveryLossResult(1_000)).toBe("BOLTER_OR_WAVE_OFF");
  });

  it("selectNightRecoveryLossResult: mid roll = deck accident", () => {
    expect(selectNightRecoveryLossResult(2_500)).toBe("RECOVERABLE_DECK_ACCIDENT");
  });

  it("selectNightRecoveryLossResult: high roll = pilot+aircraft loss", () => {
    expect(selectNightRecoveryLossResult(9_500)).toBe("PILOT_AND_AIRCRAFT_LOSS");
  });
});

describe("AC-27: Weather suspension", () => {
  function weatherPreds(
    overrides: Partial<WeatherSuspensionPredicates> = {},
  ): WeatherSuspensionPredicates {
    return {
      currentSeaState: SafeInt(4),
      windOverDeckKnots: SafeInt(24),
      aircraftClass: "PISTON",
      isLaunchOperation: true,
      isHeavyPrecipitation: false,
      isExtremePrecipitation: false,
      visibilityNauticalMiles: SafeInt(10),
      hasInstrumentLandingTechnology: false,
      deckFireIntensityBp: 0,
      ...overrides,
    };
  }

  function expectSuspended(result: WeatherSuspensionResult): void {
    expect(result.suspended).toBe(true);
    expect(result.reasonCode).toBe(CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER);
  }

  it("normal weather = not suspended", () => {
    const result = evaluateWeatherSuspension(weatherPreds());
    expect(result.suspended).toBe(false);
  });

  it("sea state 8 suspends all fixed-wing", () => {
    const result = evaluateWeatherSuspension(weatherPreds({ currentSeaState: SafeInt(8) }));
    expectSuspended(result);
  });

  it("sea state 9 suspends all fixed-wing", () => {
    const result = evaluateWeatherSuspension(weatherPreds({ currentSeaState: SafeInt(9) }));
    expectSuspended(result);
  });

  it("sea state 7 suspends heavy jets", () => {
    const result = evaluateWeatherSuspension(
      weatherPreds({ currentSeaState: SafeInt(7), aircraftClass: "HEAVY_JET" }),
    );
    expectSuspended(result);
  });

  it("sea state 7 = 5000bp rate for non-heavy", () => {
    const result = evaluateWeatherSuspension(
      weatherPreds({ currentSeaState: SafeInt(7), aircraftClass: "PISTON" }),
    );
    expect(result.suspended).toBe(false);
    expect(result.rateMultiplierBp).toBe(5_000);
  });

  it("extreme precip suspends all launch", () => {
    const result = evaluateWeatherSuspension(weatherPreds({ isExtremePrecipitation: true }));
    expectSuspended(result);
  });

  it("deck fire >= 5000 suspends launch/recovery", () => {
    const result = evaluateWeatherSuspension(weatherPreds({ deckFireIntensityBp: 5_000 }));
    expectSuspended(result);
  });

  it("vis < 2nm suspends visual recovery without ILS", () => {
    const result = evaluateWeatherSuspension(
      weatherPreds({ isLaunchOperation: false, visibilityNauticalMiles: SafeInt(1) }),
    );
    expectSuspended(result);
  });

  it("vis < 2nm does not suspend with ILS", () => {
    const result = evaluateWeatherSuspension(
      weatherPreds({
        isLaunchOperation: false,
        visibilityNauticalMiles: SafeInt(1),
        hasInstrumentLandingTechnology: true,
      }),
    );
    expect(result.suspended).toBe(false);
  });

  it("vis < 2nm does not suspend launch", () => {
    const result = evaluateWeatherSuspension(
      weatherPreds({ isLaunchOperation: true, visibilityNauticalMiles: SafeInt(1) }),
    );
    expect(result.suspended).toBe(false);
  });

  it("heavy precip = 5000bp for jet, 7500bp for piston", () => {
    const piston = evaluateWeatherSuspension(
      weatherPreds({ isHeavyPrecipitation: true, aircraftClass: "PISTON" }),
    );
    expect(piston.suspended).toBe(false);
    expect(piston.rateMultiplierBp).toBe(7_500);

    const jet = evaluateWeatherSuspension(
      weatherPreds({ isHeavyPrecipitation: true, aircraftClass: "LIGHT_JET" }),
    );
    expect(jet.suspended).toBe(false);
    expect(jet.rateMultiplierBp).toBe(5_000);
  });
});

describe("INC-6 contracts", () => {
  it("INC-6 contract IDs appear in rollup", () => {
    const ids = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((c) => c.policyId);
    expect(ids).toContain("carrier_hazard_exposure_v1");
    expect(ids).toContain("carrier_night_recovery_v1");
    expect(ids).toContain("carrier_weather_suspension_v1");
  });

  it("CarrierHazardExposure_v1 validates", () => {
    const record = {
      inputs: {
        fueledAircraftCount: SafeInt(10),
        armedAircraftCount: SafeInt(8),
        torpedoLoadedAircraftCount: SafeInt(0),
        guidedWeaponLoadedAircraftCount: SafeInt(0),
        fuelingTransferActive: false,
        ordnanceHandlingActive: false,
      },
      totalExposure: SafeInt(180),
    };
    expect(() => validateCarrierHazardExposureContract(record)).not.toThrow();
  });

  it("CarrierNightRecovery_v1 validates", () => {
    const record = {
      predicates: {
        hasNightCarrierOperationsTech: true,
        hasOperationalDeckLighting: true,
        hasValidContact: true,
        windOverDeckKnots: 20,
        aircraftClass: "PISTON",
        weatherNotSuspended: true,
        carrierCommandAccepts: true,
        hasSufficientFuel: true,
        isEmergency: false,
      },
      eligible: true,
      lossBasisBp: 250,
    };
    expect(() => validateCarrierNightRecoveryContract(record)).not.toThrow();
  });

  it("CarrierWeatherSuspension_v1 validates", () => {
    const record = {
      predicates: {
        currentSeaState: SafeInt(4),
        windOverDeckKnots: SafeInt(24),
        aircraftClass: "PISTON",
        isLaunchOperation: true,
        isHeavyPrecipitation: false,
        isExtremePrecipitation: false,
        visibilityNauticalMiles: SafeInt(10),
        hasInstrumentLandingTechnology: false,
        deckFireIntensityBp: 0,
      },
      suspended: false,
      reason: "weather conditions permit operations",
    };
    expect(() => validateCarrierWeatherSuspensionContract(record)).not.toThrow();
  });
});
