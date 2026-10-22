import { BluewaveError } from "@bluewave/contracts";
import type { SafeInt } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import { formatContractIssues } from "../schema-issues.js";
import { safeIntSchema as safeInt } from "../safe-int-schema.js";
import {
  CARRIER_CLASSIFICATIONS,
  CARRIER_OPERATIONS_RULESET_VERSION,
  DECK_CYCLE_STATES,
  JET_CARRIER_CAPABILITIES,
  OVERSIZED_CARRIER_THRESHOLD,
  OVERSIZED_COORDINATION_BP,
  OVERSIZED_DECK_CYCLE_EFFICIENCY_BP,
  OVERSIZED_HAZARD_BP,
  OVERSIZED_MAINTENANCE_COST_BP,
  OVERSIZED_SORTIE_GENERATION_BP,
} from "./constants.js";
import {
  CARRIER_OPERATIONS_INVARIANT_FAILED,
  INVALID_CARRIER_OPERATIONS_STATE,
} from "./reasonCodes.js";

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

const nonNegativeSafeInt = safeInt.check(Schema.isGreaterThanOrEqualTo(0));

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));

const basisPoint = Schema.Finite.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(10_000),
);

const nonNegativeNumber = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

const degrees = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(360),
);

function parseContract<A>(
  schema: Schema.ConstraintDecoder<A, never>,
  value: unknown,
  code: string,
): A {
  const result = Schema.decodeUnknownResult(schema)(value);
  if (Result.isFailure(result)) {
    const first = formatContractIssues(result.failure)[0];
    throw new BluewaveError(code, {
      code,
      field: first?.path ?? "unknown",
      reason: first?.message ?? "contract validation failed",
      value,
    });
  }
  return result.success;
}

const catapultDefinitionSchema = Schema.Struct({
  catapultId: nonEmptyString,
  compatible: Schema.Boolean,
  operational: Schema.Boolean,
  steamPowered: Schema.Boolean,
  conditionBp: basisPoint,
});

const liftDefinitionSchema = Schema.Struct({
  liftId: nonEmptyString,
  operational: Schema.Boolean,
  conditionBp: basisPoint,
});

const fuelStateSchema = Schema.Struct({
  fuelRemainingBp: nonNegativeSafeInt,
  fuelCapacityBp: nonNegativeSafeInt,
});

const ordnanceEntrySchema = Schema.Struct({
  ordnanceTypeId: nonEmptyString,
  quantity: nonNegativeSafeInt,
});

const reservationSchema = Schema.Struct({
  reservationId: nonEmptyString,
  squadronId: nonEmptyString,
  aircraftModelId: nonEmptyString,
  count: nonNegativeSafeInt,
});

const weatherOperabilitySchema = Schema.Struct({
  currentSeaState: nonNegativeSafeInt,
  windOverDeckKnots: nonNegativeSafeInt,
  precipitationIntensityBp: basisPoint,
  visibilityNauticalMiles: nonNegativeSafeInt,
  deckFireIntensityBp: basisPoint,
  nightOperationsActive: Schema.Boolean,
});

export const CarrierOperationsState_v1 = Schema.Struct({
  shipId: nonEmptyString,
  compiledDesignId: nonEmptyString,
  classification: Schema.Literals(CARRIER_CLASSIFICATIONS),
  physicalCapacityUnits: nonNegativeSafeInt,
  occupiedCapacityUnits: nonNegativeSafeInt,
  currentSpotValue: nonNegativeSafeInt,
  deckCycleState: Schema.Literals(DECK_CYCLE_STATES),
  deckConfigurationId: nonEmptyString,
  catapultDefinitions: Schema.Array(catapultDefinitionSchema),
  liftDefinitions: Schema.Array(liftDefinitionSchema),
  flightDeckCondition: basisPoint,
  hangarCondition: basisPoint,
  aviationFuelState: fuelStateSchema,
  ordnanceInventory: Schema.Array(ordnanceEntrySchema),
  assignedAirGroupSquadronIds: Schema.Array(nonEmptyString),
  spottedAircraftCount: nonNegativeSafeInt,
  fueledAircraftCount: nonNegativeSafeInt,
  armedAircraftCount: nonNegativeSafeInt,
  airborneAircraftCount: nonNegativeSafeInt,
  returningAircraftCount: nonNegativeSafeInt,
  damagedAircraftCount: nonNegativeSafeInt,
  activeLaunchReservations: Schema.Array(reservationSchema),
  activeRecoveryReservations: Schema.Array(reservationSchema),
  weatherOperabilityState: weatherOperabilitySchema,
  rulesetVersion: Schema.Literal(CARRIER_OPERATIONS_RULESET_VERSION),
  formulaVersion: nonEmptyString,
  stateHash: nonEmptyString,
});

export type CarrierOperationsStateContract = typeof CarrierOperationsState_v1.Type;

export function validateCarrierOperationsStateContract(
  value: unknown,
): CarrierOperationsStateContract {
  return parseContract(CarrierOperationsState_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const assignmentSchema = Schema.Struct({
  squadronId: nonEmptyString,
  aircraftModelId: nonEmptyString,
  aircraftType: nonEmptyString,
  capacityUnits: nonNegativeSafeInt,
  assignmentPriority: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(8),
  ),
});

export const CarrierCapacityAssignment_v1 = Schema.Struct({
  assignments: Schema.Array(assignmentSchema),
  physicalCapacityUnits: nonNegativeSafeInt,
  occupiedCapacityUnits: nonNegativeSafeInt,
});

export type CarrierCapacityAssignmentContract = typeof CarrierCapacityAssignment_v1.Type;

export function validateCarrierCapacityAssignmentContract(
  value: unknown,
): CarrierCapacityAssignmentContract {
  return parseContract(CarrierCapacityAssignment_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

export const OversizedCarrierPolicy_v1 = Schema.Struct({
  threshold: Schema.Literal(OVERSIZED_CARRIER_THRESHOLD),
  deckCycleEfficiencyBp: Schema.Literal(OVERSIZED_DECK_CYCLE_EFFICIENCY_BP),
  sortieGenerationBp: Schema.Literal(OVERSIZED_SORTIE_GENERATION_BP),
  maintenanceCostBp: Schema.Literal(OVERSIZED_MAINTENANCE_COST_BP),
  coordinationBp: Schema.Literal(OVERSIZED_COORDINATION_BP),
  hazardBp: Schema.Literal(OVERSIZED_HAZARD_BP),
});

export type OversizedCarrierPolicyContract = typeof OversizedCarrierPolicy_v1.Type;

export function validateOversizedCarrierPolicyContract(
  value: unknown,
): OversizedCarrierPolicyContract {
  return parseContract(OversizedCarrierPolicy_v1, value, CARRIER_OPERATIONS_INVARIANT_FAILED);
}

export const CarrierSpotValue_v1 = Schema.Struct({
  baseSpotValue: nonNegativeSafeInt,
  operationalCatapultCount: nonNegativeInt,
  speedKnots: nonNegativeNumber,
  deckConfigurationId: nonEmptyString,
  flightDeckConditionBp: basisPoint,
  technologyLevel: nonEmptyString,
  compiledAircraftCapacity: nonNegativeInt,
  finalSpotValue: nonNegativeSafeInt,
});

export type CarrierSpotValueContract = typeof CarrierSpotValue_v1.Type;

export const CarrierDeckCycleState_v1 = Schema.Struct({
  fromState: Schema.Literals(DECK_CYCLE_STATES),
  toState: Schema.Literals(DECK_CYCLE_STATES),
  timestamp: nonNegativeInt,
  transitionValidated: Schema.Boolean,
});

export type CarrierDeckCycleStateContract = typeof CarrierDeckCycleState_v1.Type;

export function validateCarrierDeckCycleStateContract(
  value: unknown,
): CarrierDeckCycleStateContract {
  return parseContract(CarrierDeckCycleState_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const operationClassSchema = Schema.Literals([
  "EMERGENCY_RECOVERY",
  "ORDINARY_RECOVERY",
  "ALERT_CAP_LAUNCH",
  "ACTIVE_STRIKE_LAUNCH",
  "SEARCH_LAUNCH",
  "ORDINARY_CAP_LAUNCH",
  "SPOTTING",
  "REFUELING_REARMING",
  "STRIKE_DOWN",
]);

const contentionPredicatesSchema = Schema.Struct({
  hasAngledDeck: Schema.Boolean,
  deckDamagePermitsOverlap: Schema.Boolean,
  weatherPermitsOverlap: Schema.Boolean,
  trafficPermitsOverlap: Schema.Boolean,
  hasFueledArmedAircraftOnDeck: Schema.Boolean,
  clearDeckCapacitySufficient: Schema.Boolean,
});

export const CarrierDeckContention_v1 = Schema.Struct({
  requested: operationClassSchema,
  currentOperations: Schema.Array(operationClassSchema),
  predicates: contentionPredicatesSchema,
  permitted: Schema.Boolean,
});

export type CarrierDeckContentionContract = typeof CarrierDeckContention_v1.Type;

export function validateCarrierDeckContentionContract(
  value: unknown,
): CarrierDeckContentionContract {
  return parseContract(CarrierDeckContention_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

export const JetCarrierCapability_v1 = Schema.Struct({
  trueStandardDisplacementKg: nonNegativeSafeInt,
  hasCompatibleOperationalSteamCatapult: Schema.Boolean,
  hasAngledDeck: Schema.Boolean,
  hasStrengthenedArrestingGear: Schema.Boolean,
  hasJetCompatibleLiftsAndHangar: Schema.Boolean,
  hasAdequateDeckStrengthAndHeatResistance: Schema.Boolean,
  adoptedTechnologies: Schema.Array(nonEmptyString),
  determinedCapability: Schema.Literals(JET_CARRIER_CAPABILITIES),
});

export type JetCarrierCapabilityContract = typeof JetCarrierCapability_v1.Type;

const strikeSquadronAllocationSchema = Schema.Struct({
  squadronId: nonEmptyString,
  aircraftModelId: nonEmptyString,
  count: nonNegativeSafeInt,
});

const strikeOrdnanceReservationSchema = Schema.Struct({
  ordnanceTypeId: nonEmptyString,
  quantity: nonNegativeSafeInt,
});

const strikeRecoveryPlanSchema = Schema.Struct({
  returnCarrierId: nonEmptyString,
  recoveryWindowStart: nonNegativeInt,
  recoveryWindowEnd: nonNegativeInt,
  fuelReserveBp: nonNegativeSafeInt,
  divertFieldIds: Schema.Array(nonEmptyString),
});

export const CarrierStrikeState_v1 = Schema.Struct({
  strikeId: nonEmptyString,
  originCarrierIds: Schema.Array(nonEmptyString),
  targetReportId: nonEmptyString,
  targetConfidenceBp: basisPoint,
  allocatedSquadrons: Schema.Array(strikeSquadronAllocationSchema),
  escortAllocationIds: Schema.Array(nonEmptyString),
  loadoutId: nonEmptyString,
  ordnanceReservations: Schema.Array(strikeOrdnanceReservationSchema),
  coordinationMode: Schema.Literals(["UNCOORDINATED", "COORDINATED"]),
  readinessStartMinute: nonNegativeInt,
  plannedLaunchMinute: nonNegativeInt,
  actualLaunchMinute: nonNegativeInt,
  fuelRequirementBp: nonNegativeSafeInt,
  fuelReserveBp: nonNegativeSafeInt,
  spotValueRequirement: nonNegativeSafeInt,
  formationState: Schema.Literals(["FORMING", "FORMED", "DISPERSED", "SCATTERED"]),
  missionState: Schema.Literals([
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
  ]),
  recoveryPlan: strikeRecoveryPlanSchema,
  rulesetVersion: nonEmptyString,
  strikeHash: nonEmptyString,
});

export type CarrierStrikeStateContract = typeof CarrierStrikeState_v1.Type;

export function validateCarrierStrikeStateContract(value: unknown): CarrierStrikeStateContract {
  return parseContract(CarrierStrikeState_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

export const CarrierLaunchRate_v1 = Schema.Struct({
  operationalCatapultCount: nonNegativeInt,
  usingSteamCatapults: Schema.Boolean,
  isLightJet: Schema.Boolean,
  isHeavyJet: Schema.Boolean,
  isPiston: Schema.Boolean,
  effectiveRate: positiveInt,
  durationMinutes: positiveInt,
  aircraftCount: positiveInt,
});

export type CarrierLaunchRateContract = typeof CarrierLaunchRate_v1.Type;

export function validateCarrierLaunchRateContract(value: unknown): CarrierLaunchRateContract {
  return parseContract(CarrierLaunchRate_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const courseIntervalSchema = Schema.Struct({
  minDegrees: degrees,
  maxDegrees: degrees,
});

const speedIntervalSchema = Schema.Struct({
  minKnots: nonNegativeNumber,
  maxKnots: nonNegativeNumber,
});

const windVectorSchema = Schema.Struct({
  ambientWindSpeedKnots: nonNegativeNumber,
  ambientWindDirectionDegrees: degrees,
  carrierSpeedKnots: nonNegativeNumber,
  carrierCourseDegrees: degrees,
});

export const CarrierWindOverDeck_v1 = Schema.Struct({
  requiredCourse: courseIntervalSchema,
  requiredSpeed: speedIntervalSchema,
  windVector: windVectorSchema,
  deckOperationId: nonEmptyString,
  relativeWodKnots: nonNegativeNumber,
  aircraftClass: Schema.Literals(["PISTON", "LIGHT_JET", "HEAVY_JET", "HELICOPTER", "UNKNOWN"]),
  isLaunch: Schema.Boolean,
  wodSufficient: Schema.Boolean,
});

export type CarrierWindOverDeckContract = typeof CarrierWindOverDeck_v1.Type;

export function validateCarrierWindOverDeckContract(value: unknown): CarrierWindOverDeckContract {
  return parseContract(CarrierWindOverDeck_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const hazardExposureInputsSchema = Schema.Struct({
  fueledAircraftCount: nonNegativeSafeInt,
  armedAircraftCount: nonNegativeSafeInt,
  torpedoLoadedAircraftCount: nonNegativeSafeInt,
  guidedWeaponLoadedAircraftCount: nonNegativeSafeInt,
  fuelingTransferActive: Schema.Boolean,
  ordnanceHandlingActive: Schema.Boolean,
});

export const CarrierHazardExposure_v1 = Schema.Struct({
  inputs: hazardExposureInputsSchema,
  totalExposure: nonNegativeSafeInt,
});

export type CarrierHazardExposureContract = typeof CarrierHazardExposure_v1.Type;

export function validateCarrierHazardExposureContract(
  value: unknown,
): CarrierHazardExposureContract {
  return parseContract(CarrierHazardExposure_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const nightRecoveryPredicatesSchema = Schema.Struct({
  hasNightCarrierOperationsTech: Schema.Boolean,
  hasOperationalDeckLighting: Schema.Boolean,
  hasValidContact: Schema.Boolean,
  windOverDeckKnots: nonNegativeNumber,
  aircraftClass: nonEmptyString,
  weatherNotSuspended: Schema.Boolean,
  carrierCommandAccepts: Schema.Boolean,
  hasSufficientFuel: Schema.Boolean,
  isEmergency: Schema.Boolean,
});

export const CarrierNightRecovery_v1 = Schema.Struct({
  predicates: nightRecoveryPredicatesSchema,
  eligible: Schema.Boolean,
  lossBasisBp: basisPoint,
});

export type CarrierNightRecoveryContract = typeof CarrierNightRecovery_v1.Type;

export function validateCarrierNightRecoveryContract(value: unknown): CarrierNightRecoveryContract {
  return parseContract(CarrierNightRecovery_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const weatherSuspensionPredicatesSchema = Schema.Struct({
  currentSeaState: nonNegativeSafeInt,
  windOverDeckKnots: nonNegativeSafeInt,
  aircraftClass: nonEmptyString,
  isLaunchOperation: Schema.Boolean,
  isHeavyPrecipitation: Schema.Boolean,
  isExtremePrecipitation: Schema.Boolean,
  visibilityNauticalMiles: nonNegativeSafeInt,
  hasInstrumentLandingTechnology: Schema.Boolean,
  deckFireIntensityBp: basisPoint,
});

export const CarrierWeatherSuspension_v1 = Schema.Struct({
  predicates: weatherSuspensionPredicatesSchema,
  suspended: Schema.Boolean,
  rateMultiplierBp: Schema.optional(basisPoint),
  reason: Schema.String,
});

export type CarrierWeatherSuspensionContract = typeof CarrierWeatherSuspension_v1.Type;

export function validateCarrierWeatherSuspensionContract(
  value: unknown,
): CarrierWeatherSuspensionContract {
  return parseContract(CarrierWeatherSuspension_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const recoveryRequestSchema = Schema.Struct({
  aircraftId: nonEmptyString,
  priorityLevel: Schema.Literals([
    "EMERGENCY_FUEL",
    "DAMAGED_AIRCRAFT",
    "HAZARDOUS_ORDNANCE",
    "IMMEDIATE_CAP_RELAUNCH",
    "RETURNING_STRIKE",
    "SEARCH",
    "NORMAL_CAP",
  ]),
  squadronId: nonEmptyString,
  fuelStateBp: basisPoint,
  isDamaged: Schema.Boolean,
  hasHazardousOrdnance: Schema.Boolean,
});

export const CarrierRecoveryPriority_v1 = Schema.Struct({
  requests: Schema.Array(recoveryRequestSchema),
  deckCapacityAvailable: nonNegativeSafeInt,
  requestedSlots: nonNegativeSafeInt,
  carrierHasAlternateLanding: Schema.Boolean,
  sortedAircraftIds: Schema.Array(Schema.String),
});

export type CarrierRecoveryPriorityContract = typeof CarrierRecoveryPriority_v1.Type;

export function validateCarrierRecoveryPriorityContract(
  value: unknown,
): CarrierRecoveryPriorityContract {
  return parseContract(CarrierRecoveryPriority_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

const ordnanceTransactionSchema = Schema.Struct({
  ordnanceTypeId: nonEmptyString,
  quantity: nonNegativeSafeInt,
  transactionType: Schema.Literals(["RESERVE", "CONSUME", "RETURN_TO_STORAGE", "JETTISON"]),
  timestamp: nonNegativeInt,
});

export const CarrierOrdnanceState_v1 = Schema.Struct({
  transactions: Schema.Array(ordnanceTransactionSchema),
  inventoryTypeId: nonEmptyString,
  availableQuantity: nonNegativeSafeInt,
  requestedQuantity: nonNegativeSafeInt,
  sufficient: Schema.Boolean,
});

export type CarrierOrdnanceStateContract = typeof CarrierOrdnanceState_v1.Type;

export function validateCarrierOrdnanceStateContract(value: unknown): CarrierOrdnanceStateContract {
  return parseContract(CarrierOrdnanceState_v1, value, INVALID_CARRIER_OPERATIONS_STATE);
}

type _AssertSafeInt<T> = T extends SafeInt ? true : never;
const _assertSafeIntLeaves: [
  _AssertSafeInt<CarrierOperationsStateContract["physicalCapacityUnits"]>,
  _AssertSafeInt<CarrierOperationsStateContract["occupiedCapacityUnits"]>,
  _AssertSafeInt<CarrierOperationsStateContract["currentSpotValue"]>,
  _AssertSafeInt<CarrierOperationsStateContract["spottedAircraftCount"]>,
  _AssertSafeInt<CarrierOperationsStateContract["aviationFuelState"]["fuelRemainingBp"]>,
  _AssertSafeInt<CarrierOperationsStateContract["ordnanceInventory"][number]["quantity"]>,
  _AssertSafeInt<CarrierOperationsStateContract["weatherOperabilityState"]["currentSeaState"]>,
  _AssertSafeInt<CarrierCapacityAssignmentContract["physicalCapacityUnits"]>,
  _AssertSafeInt<CarrierCapacityAssignmentContract["assignments"][number]["capacityUnits"]>,
  _AssertSafeInt<JetCarrierCapabilityContract["trueStandardDisplacementKg"]>,
  _AssertSafeInt<CarrierStrikeStateContract["fuelRequirementBp"]>,
  _AssertSafeInt<CarrierStrikeStateContract["recoveryPlan"]["fuelReserveBp"]>,
  _AssertSafeInt<CarrierHazardExposureContract["totalExposure"]>,
  _AssertSafeInt<CarrierRecoveryPriorityContract["deckCapacityAvailable"]>,
  _AssertSafeInt<CarrierOrdnanceStateContract["availableQuantity"]>,
  _AssertSafeInt<CarrierOrdnanceStateContract["transactions"][number]["quantity"]>,
  _AssertSafeInt<CarrierSpotValueContract["baseSpotValue"]>,
  _AssertSafeInt<CarrierWeatherSuspensionContract["predicates"]["currentSeaState"]>,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

export const SHIPPED_CARRIER_OPERATIONS_CONTRACT = {
  state: CarrierOperationsState_v1,
  capacityAssignment: CarrierCapacityAssignment_v1,
  oversizedPolicy: OversizedCarrierPolicy_v1,
  deckCycleState: CarrierDeckCycleState_v1,
  deckContention: CarrierDeckContention_v1,
  strikeState: CarrierStrikeState_v1,
  launchRate: CarrierLaunchRate_v1,
  windOverDeck: CarrierWindOverDeck_v1,
  hazardExposure: CarrierHazardExposure_v1,
  nightRecovery: CarrierNightRecovery_v1,
  weatherSuspension: CarrierWeatherSuspension_v1,
  recoveryPriority: CarrierRecoveryPriority_v1,
  ordnanceState: CarrierOrdnanceState_v1,
} as const;
