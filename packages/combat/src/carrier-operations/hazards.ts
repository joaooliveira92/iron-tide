import { SafeInt, BluewaveError } from "@bluewave/contracts";
import { CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT } from "./constants.js";
import {
  CARRIER_NIGHT_RECOVERY_INELIGIBLE,
  CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
} from "./reasonCodes.js";

export const HAZARD_WEIGHTS = {
  FUELED_AIRCRAFT: 10,
  ARMED_AIRCRAFT: 10,
  TORPEDO_LOADED_AIRCRAFT: 15,
  GUIDED_WEAPON_LOADED_AIRCRAFT: 20,
  ACTIVE_FUELING_TRANSFER: 100,
  ACTIVE_ORDNANCE_HANDLING: 100,
} as const;

export interface HazardExposureInputs {
  fueledAircraftCount: SafeInt;
  armedAircraftCount: SafeInt;
  torpedoLoadedAircraftCount: SafeInt;
  guidedWeaponLoadedAircraftCount: SafeInt;
  fuelingTransferActive: boolean;
  ordnanceHandlingActive: boolean;
}

export function computeHazardExposure(inputs: HazardExposureInputs): SafeInt {
  let total = 0;
  total += Number(inputs.fueledAircraftCount) * HAZARD_WEIGHTS.FUELED_AIRCRAFT;
  total += Number(inputs.armedAircraftCount) * HAZARD_WEIGHTS.ARMED_AIRCRAFT;
  total += Number(inputs.torpedoLoadedAircraftCount) * HAZARD_WEIGHTS.TORPEDO_LOADED_AIRCRAFT;
  total +=
    Number(inputs.guidedWeaponLoadedAircraftCount) * HAZARD_WEIGHTS.GUIDED_WEAPON_LOADED_AIRCRAFT;
  if (inputs.fuelingTransferActive) total += HAZARD_WEIGHTS.ACTIVE_FUELING_TRANSFER;
  if (inputs.ordnanceHandlingActive) total += HAZARD_WEIGHTS.ACTIVE_ORDNANCE_HANDLING;
  return SafeInt(total);
}

export const BASE_HAZARD_PROBABILITIES = {
  FUELED_AIRCRAFT_IGNITION: 2_000,
  ARMED_AIRCRAFT_ORDNANCE_REACTION: 1_500,
  TORPEDO_WARHEAD_REACTION: 2_500,
  MISSILE_OR_GUIDED_REACTION: 2_000,
  HANGAR_FUEL_PROPAGATION: 2_500,
  ACTIVE_FUELING_PROPAGATION: 5_000,
} as const;

export type HazardEventType = keyof typeof BASE_HAZARD_PROBABILITIES;

export interface HazardProbabilityInputs {
  baseProbabilityBp: number;
  exposureMultiplierBp: number;
  damageMultiplierBp: number;
  firefightingMultiplierBp: number;
  deckConfigurationMultiplierBp: number;
}

export function computeFinalHazardProbability(inputs: HazardProbabilityInputs): number {
  const product =
    BigInt(inputs.baseProbabilityBp) *
    BigInt(inputs.exposureMultiplierBp) *
    BigInt(inputs.damageMultiplierBp) *
    BigInt(inputs.firefightingMultiplierBp) *
    BigInt(inputs.deckConfigurationMultiplierBp);
  const denominator = BigInt(CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT) ** 4n;
  const floored = Number(product / denominator);
  return Math.max(0, Math.min(10_000, floored));
}

export const NIGHT_RECOVERY_LOSS_BASES = {
  DAYLIGHT: 250,
  TWILIGHT: 750,
  TRAINED_NIGHT: 2_500,
  EMERGENCY: 7_500,
} as const;

export const NIGHT_RECOVERY_FAILURE_RESULTS = [
  "BOLTER_OR_WAVE_OFF",
  "RECOVERABLE_DECK_ACCIDENT",
  "AIRCRAFT_LOST_OVERBOARD",
  "COLLISION_WITH_PARKED_AIRCRAFT",
  "SEVERE_DECK_CRASH",
  "PILOT_AND_AIRCRAFT_LOSS",
] as const;

export type NightRecoveryFailureResult = (typeof NIGHT_RECOVERY_FAILURE_RESULTS)[number];

export function selectNightRecoveryLossResult(rollBp: number): NightRecoveryFailureResult {
  if (rollBp < 1_500) return "BOLTER_OR_WAVE_OFF";
  if (rollBp < 3_500) return "RECOVERABLE_DECK_ACCIDENT";
  if (rollBp < 5_500) return "AIRCRAFT_LOST_OVERBOARD";
  if (rollBp < 7_500) return "COLLISION_WITH_PARKED_AIRCRAFT";
  if (rollBp < 9_000) return "SEVERE_DECK_CRASH";
  return "PILOT_AND_AIRCRAFT_LOSS";
}

export interface NightRecoveryPredicates {
  hasNightCarrierOperationsTech: boolean;
  hasOperationalDeckLighting: boolean;
  hasValidContact: boolean;
  windOverDeckKnots: number;
  aircraftClass: string;
  weatherNotSuspended: boolean;
  carrierCommandAccepts: boolean;
  hasSufficientFuel: boolean;
  isEmergency: boolean;
}

export function isNightRecoveryEligible(predicates: NightRecoveryPredicates): boolean {
  if (!predicates.weatherNotSuspended) return false;
  if (!predicates.hasValidContact) return false;
  if (!predicates.carrierCommandAccepts) return false;
  if (!predicates.hasSufficientFuel && !predicates.isEmergency) return false;

  if (predicates.isEmergency) return true;

  if (!predicates.hasNightCarrierOperationsTech) return false;
  if (!predicates.hasOperationalDeckLighting) return false;

  return true;
}

export function assertNightRecoveryEligible(predicates: NightRecoveryPredicates): void {
  if (!isNightRecoveryEligible(predicates)) {
    throw new BluewaveError(CARRIER_NIGHT_RECOVERY_INELIGIBLE, {
      code: CARRIER_NIGHT_RECOVERY_INELIGIBLE,
      field: "nightRecoveryPredicates",
      reason: "night recovery eligibility predicates not met",
      value: predicates,
    });
  }
}

export interface WeatherSuspensionPredicates {
  currentSeaState: SafeInt;
  windOverDeckKnots: SafeInt;
  aircraftClass: string;
  isLaunchOperation: boolean;
  isHeavyPrecipitation: boolean;
  isExtremePrecipitation: boolean;
  visibilityNauticalMiles: SafeInt;
  hasInstrumentLandingTechnology: boolean;
  deckFireIntensityBp: number;
}

export interface WeatherSuspensionResult {
  suspended: boolean;
  rateMultiplierBp: number | undefined;
  reasonCode: string | undefined;
  reason: string;
}

export function evaluateWeatherSuspension(
  predicates: WeatherSuspensionPredicates,
): WeatherSuspensionResult {
  const seaState = Number(predicates.currentSeaState);
  const vis = Number(predicates.visibilityNauticalMiles);
  const deckFire = predicates.deckFireIntensityBp;

  if (seaState >= 8) {
    return {
      suspended: true,
      rateMultiplierBp: undefined,
      reasonCode: CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
      reason: `sea state ${seaState}: all fixed-wing operations suspended`,
    };
  }

  if (seaState === 7 && predicates.aircraftClass === "HEAVY_JET") {
    return {
      suspended: true,
      rateMultiplierBp: undefined,
      reasonCode: CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
      reason: "sea state 7: heavy jet operations suspended",
    };
  }

  if (predicates.isExtremePrecipitation && predicates.isLaunchOperation) {
    return {
      suspended: true,
      rateMultiplierBp: undefined,
      reasonCode: CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
      reason: "extreme precipitation: all launch suspended",
    };
  }

  if (deckFire >= 5_000) {
    return {
      suspended: true,
      rateMultiplierBp: undefined,
      reasonCode: CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
      reason: `deck fire intensity ${deckFire}: launch and recovery suspended`,
    };
  }

  if (!predicates.isLaunchOperation && vis < 2 && !predicates.hasInstrumentLandingTechnology) {
    return {
      suspended: true,
      rateMultiplierBp: undefined,
      reasonCode: CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER,
      reason: "visibility below 2nm: visual recovery suspended",
    };
  }

  let rateMultiplierBp: number | undefined;

  if (seaState === 7) {
    rateMultiplierBp = 5_000;
  }

  if (predicates.isHeavyPrecipitation) {
    const precipRate = predicates.aircraftClass === "PISTON" ? 7_500 : 5_000;
    rateMultiplierBp =
      rateMultiplierBp !== undefined ? Math.min(rateMultiplierBp, precipRate) : precipRate;
  }

  return {
    suspended: false,
    rateMultiplierBp,
    reasonCode: undefined,
    reason: "weather conditions permit operations",
  };
}
