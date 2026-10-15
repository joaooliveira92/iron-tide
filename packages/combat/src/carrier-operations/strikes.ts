import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
  OVERSIZED_CARRIER_THRESHOLD,
} from "./constants.js";
import { CARRIER_STRIKE_EXCEEDS_SPOT_VALUE } from "./reasonCodes.js";

export const STRIKE_COORDINATION_MODES = ["UNCOORDINATED", "COORDINATED"] as const;
export type StrikeCoordinationMode = (typeof STRIKE_COORDINATION_MODES)[number];

export const MISSION_STATES = [
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
] as const;
export type MissionState = (typeof MISSION_STATES)[number];

export const FORMATION_STATES = ["FORMING", "FORMED", "DISPERSED", "SCATTERED"] as const;
export type FormationState = (typeof FORMATION_STATES)[number];

export interface CarrierStrikeState {
  strikeId: string;
  originCarrierIds: readonly string[];
  targetReportId: string;
  targetConfidenceBp: number;
  allocatedSquadrons: readonly StrikeSquadronAllocation[];
  escortAllocationIds: readonly string[];
  loadoutId: string;
  ordnanceReservations: readonly StrikeOrdnanceReservation[];
  coordinationMode: StrikeCoordinationMode;
  readinessStartMinute: number;
  plannedLaunchMinute: number;
  actualLaunchMinute: number;
  fuelRequirementBp: SafeInt;
  fuelReserveBp: SafeInt;
  spotValueRequirement: SafeInt;
  formationState: FormationState;
  missionState: MissionState;
  recoveryPlan: StrikeRecoveryPlan;
  rulesetVersion: string;
  strikeHash: string;
}

export interface StrikeSquadronAllocation {
  squadronId: string;
  aircraftModelId: string;
  count: SafeInt;
}

export interface StrikeOrdnanceReservation {
  ordnanceTypeId: string;
  quantity: SafeInt;
}

export interface StrikeRecoveryPlan {
  returnCarrierId: string;
  recoveryWindowStart: number;
  recoveryWindowEnd: number;
  fuelReserveBp: SafeInt;
  divertFieldIds: readonly string[];
}

export const BASE_PREP_TIMES = {
  UNCOORDINATED: 20,
  COORDINATED: 30,
  ALERT_CAP: 5,
  SEARCH: 10,
  EMERGENCY_RE_STRIKE: 10,
} as const;

export const STRIKE_TIME_MODIFIERS = {
  IMPROVED_DECK_CREW_BP: 9_000,
  MODERN_DECK_CREW_BP: 8_000,
  COMPATIBLE_CATAPULT_BP: 9_000,
  ANGLED_DECK_BP: 9_000,
  DEGRADED_FLIGHT_DECK_BP: 12_500,
  HEAVY_PRECIPITATION_BP: 15_000,
  OVERSIZED_CARRIER_BP: 11_000,
} as const;

export const COORDINATED_STRIKE_MODIFIERS = {
  ESCORT_COHESION_BP: 12_000,
  STRIKE_COHESION_BP: 12_000,
  MUTUAL_DEFENSE_BP: 11_000,
  DISPERSION_BP: 8_500,
  OPERATIONAL_LOSS_BP: 9_000,
  COORDINATED_FORMATION_MINUTES: 10,
  UNCOORDINATED_FORMATION_MINUTES: 5,
} as const;

export const LAUNCH_RATES = {
  NO_CATAPULT_PISTON: 2,
  ONE_CATAPULT: 3,
  TWO_PLUS_CATAPULTS: 4,
  STEAM_LIGHT_JET: 2,
  TWO_PLUS_STEAM: 3,
  HEAVY_JET: 2,
} as const;

export function basePrepMinutes(
  mode: StrikeCoordinationMode,
  isAlert: boolean,
  isSearch: boolean,
  isEmergencyRestrike: boolean,
): number {
  if (isAlert) return BASE_PREP_TIMES.ALERT_CAP;
  if (isSearch) return BASE_PREP_TIMES.SEARCH;
  if (isEmergencyRestrike) return BASE_PREP_TIMES.EMERGENCY_RE_STRIKE;
  if (mode === "COORDINATED") return BASE_PREP_TIMES.COORDINATED;
  return BASE_PREP_TIMES.UNCOORDINATED;
}

export interface StrikeTimeInputs {
  baseMinutes: number;
  deckCrewBp: number;
  catapultBp: number;
  deckConfigBp: number;
  damageBp: number;
  weatherBp: number;
  oversizedBp: number;
}

export function computeFinalStrikeTime(inputs: StrikeTimeInputs): number {
  const product =
    BigInt(inputs.baseMinutes) *
    BigInt(inputs.deckCrewBp) *
    BigInt(inputs.catapultBp) *
    BigInt(inputs.deckConfigBp) *
    BigInt(inputs.damageBp) *
    BigInt(inputs.weatherBp) *
    BigInt(inputs.oversizedBp);
  const denominator = BigInt(CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT) ** 6n;
  const ceiled = Number((product + denominator - 1n) / denominator);
  return Math.max(5, Math.min(90, ceiled));
}

export function strikeTimeMultiplierFromCapacity(compiledAircraftCapacity: number): number {
  if (compiledAircraftCapacity > OVERSIZED_CARRIER_THRESHOLD) {
    return STRIKE_TIME_MODIFIERS.OVERSIZED_CARRIER_BP;
  }
  return CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT;
}

export function coordinatedFormationMinutes(isCoordinated: boolean): number {
  return isCoordinated
    ? COORDINATED_STRIKE_MODIFIERS.COORDINATED_FORMATION_MINUTES
    : COORDINATED_STRIKE_MODIFIERS.UNCOORDINATED_FORMATION_MINUTES;
}

export function coordinatedStrikeBp(
  modifier: keyof typeof COORDINATED_STRIKE_MODIFIERS,
  isCoordinated: boolean,
): number {
  if (!isCoordinated) return CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT;
  return COORDINATED_STRIKE_MODIFIERS[modifier];
}

export function spotLaunchCheck(
  launchCycleAircraftCount: number,
  finalSpotValue: SafeInt,
): boolean {
  return launchCycleAircraftCount <= Number(finalSpotValue);
}

export function assertSpotLaunchPermitted(
  launchCycleAircraftCount: number,
  finalSpotValue: SafeInt,
): void {
  if (!spotLaunchCheck(launchCycleAircraftCount, finalSpotValue)) {
    throw new BluewaveError(CARRIER_STRIKE_EXCEEDS_SPOT_VALUE, {
      code: CARRIER_STRIKE_EXCEEDS_SPOT_VALUE,
      field: "launchCycleAircraftCount",
      reason: `launch count ${launchCycleAircraftCount} exceeds spot value ${finalSpotValue}`,
      value: { launchCycleAircraftCount, finalSpotValue },
    });
  }
}

export interface LaunchRateInputs {
  operationalCatapultCount: number;
  usingSteamCatapults: boolean;
  isLightJet: boolean;
  isHeavyJet: boolean;
  isPiston: boolean;
}

export function effectiveLaunchRate(inputs: LaunchRateInputs): number {
  if (inputs.isHeavyJet) return LAUNCH_RATES.HEAVY_JET;
  if (inputs.isLightJet && inputs.usingSteamCatapults) {
    if (inputs.operationalCatapultCount >= 2) return LAUNCH_RATES.TWO_PLUS_STEAM;
    return LAUNCH_RATES.STEAM_LIGHT_JET;
  }
  if (inputs.operationalCatapultCount >= 2) return LAUNCH_RATES.TWO_PLUS_CATAPULTS;
  if (inputs.operationalCatapultCount === 1) return LAUNCH_RATES.ONE_CATAPULT;
  return LAUNCH_RATES.NO_CATAPULT_PISTON;
}

export function launchDurationMinutes(aircraftCount: number, rate: number): number {
  return Math.ceil(aircraftCount / rate);
}
