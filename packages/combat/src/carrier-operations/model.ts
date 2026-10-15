import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  CARRIER_OPERATIONS_RULESET_VERSION,
  CARRIER_CLASSIFICATIONS,
  CVL_MIN_CAPACITY,
  CVL_MAX_CAPACITY,
  ORDINARY_SLOT_CAPACITY_UNITS,
  LIGHT_JET_CAPACITY_UNITS,
  HEAVY_JET_CAPACITY_UNITS,
  HELICOPTER_CAPACITY_UNITS,
  OVERSIZED_CARRIER_THRESHOLD,
  OVERSIZED_DECK_CYCLE_EFFICIENCY_BP,
  OVERSIZED_SORTIE_GENERATION_BP,
  OVERSIZED_MAINTENANCE_COST_BP,
  OVERSIZED_COORDINATION_BP,
  OVERSIZED_HAZARD_BP,
  DECK_CYCLE_STATES,
  type CarrierClassification,
  type DeckCycleState,
} from "./constants.js";
import {
  INVALID_CARRIER_OPERATIONS_STATE,
  CARRIER_OPERATIONS_INVARIANT_FAILED,
} from "./reasonCodes.js";

export interface CarrierOperationsState {
  shipId: string;
  compiledDesignId: string;
  classification: CarrierClassification;
  physicalCapacityUnits: SafeInt;
  occupiedCapacityUnits: SafeInt;
  currentSpotValue: SafeInt;
  deckCycleState: DeckCycleState;
  deckConfigurationId: string;
  catapultDefinitions: readonly CatapultDefinition[];
  liftDefinitions: readonly LiftDefinition[];
  flightDeckCondition: number;
  hangarCondition: number;
  aviationFuelState: FuelState;
  ordnanceInventory: readonly OrdnanceInventoryEntry[];
  assignedAirGroupSquadronIds: readonly string[];
  spottedAircraftCount: SafeInt;
  fueledAircraftCount: SafeInt;
  armedAircraftCount: SafeInt;
  airborneAircraftCount: SafeInt;
  returningAircraftCount: SafeInt;
  damagedAircraftCount: SafeInt;
  activeLaunchReservations: readonly LaunchRecoveryReservation[];
  activeRecoveryReservations: readonly LaunchRecoveryReservation[];
  weatherOperabilityState: WeatherOperabilityState;
  rulesetVersion: string;
  formulaVersion: string;
  stateHash: string;
}

export interface CatapultDefinition {
  catapultId: string;
  compatible: boolean;
  operational: boolean;
  steamPowered: boolean;
  conditionBp: number;
}

export interface LiftDefinition {
  liftId: string;
  operational: boolean;
  conditionBp: number;
}

export interface FuelState {
  fuelRemainingBp: SafeInt;
  fuelCapacityBp: SafeInt;
}

export interface OrdnanceInventoryEntry {
  ordnanceTypeId: string;
  quantity: SafeInt;
}

export interface LaunchRecoveryReservation {
  reservationId: string;
  squadronId: string;
  aircraftModelId: string;
  count: SafeInt;
}

export interface WeatherOperabilityState {
  currentSeaState: SafeInt;
  windOverDeckKnots: SafeInt;
  precipitationIntensityBp: SafeInt;
  visibilityNauticalMiles: SafeInt;
  deckFireIntensityBp: SafeInt;
  nightOperationsActive: boolean;
}

export function carrierClassification(compiledAircraftCapacity: number): CarrierClassification {
  if (compiledAircraftCapacity < CVL_MIN_CAPACITY) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "compiledAircraftCapacity",
      reason: `capacity ${compiledAircraftCapacity} below minimum ${CVL_MIN_CAPACITY} for carrier classification`,
      value: compiledAircraftCapacity,
    });
  }
  return compiledAircraftCapacity <= CVL_MAX_CAPACITY ? "CVL" : "CV";
}

export function physicalCapacityUnits(compiledAircraftCapacity: number): SafeInt {
  return SafeInt(compiledAircraftCapacity * ORDINARY_SLOT_CAPACITY_UNITS);
}

export function capacityUnitsForAircraftType(aircraftType: string): SafeInt {
  switch (aircraftType) {
    case "FIGHTER":
    case "TORPEDO_BOMBER":
    case "DIVE_BOMBER":
    case "MEDIUM_BOMBER":
    case "PATROL_AIRCRAFT":
    case "FLOATPLANE_SCOUT":
    case "AIRSHIP":
    case "SPECIAL_SQUADRON":
      return SafeInt(ORDINARY_SLOT_CAPACITY_UNITS);
    case "LIGHT_JET_FIGHTER":
      return SafeInt(LIGHT_JET_CAPACITY_UNITS);
    case "HEAVY_JET_FIGHTER":
      return SafeInt(HEAVY_JET_CAPACITY_UNITS);
    case "JET_ATTACK_AIRCRAFT":
      return SafeInt(LIGHT_JET_CAPACITY_UNITS);
    case "HELICOPTER":
      return SafeInt(HELICOPTER_CAPACITY_UNITS);
    default:
      throw new BluewaveError(CARRIER_OPERATIONS_INVARIANT_FAILED, {
        code: CARRIER_OPERATIONS_INVARIANT_FAILED,
        field: "aircraftType",
        reason: "unknown aircraft type for capacity unit lookup",
        value: aircraftType,
      });
  }
}

export function capacityCheck(
  physicalCapacityUnits: SafeInt,
  occupiedCapacityUnits: SafeInt,
  assignedCapacityUnits: SafeInt,
): boolean {
  const total = SafeInt.add(occupiedCapacityUnits, assignedCapacityUnits);
  return total <= physicalCapacityUnits;
}

export enum AssignmentPriority {
  CAP = 1,
  PERMANENT = 2,
  RETURNING = 3,
  STRIKE = 4,
  SEARCH = 5,
  REPLACEMENT = 6,
  FERRY = 7,
  IDENTIFIER = 8,
}

export interface CarrierCapacityAssignment {
  squadronId: string;
  aircraftModelId: string;
  aircraftType: string;
  capacityUnits: SafeInt;
  assignmentPriority: AssignmentPriority;
}

export function assignmentOrderComparator(
  a: CarrierCapacityAssignment,
  b: CarrierCapacityAssignment,
): number {
  if (a.assignmentPriority !== b.assignmentPriority) {
    return a.assignmentPriority - b.assignmentPriority;
  }
  if (a.squadronId !== b.squadronId) {
    return a.squadronId < b.squadronId ? -1 : 1;
  }
  if (a.aircraftModelId !== b.aircraftModelId) {
    return a.aircraftModelId < b.aircraftModelId ? -1 : 1;
  }
  return 0;
}

export function assignAircraft(
  assignments: readonly CarrierCapacityAssignment[],
  physicalCapacityUnits: SafeInt,
  occupiedCapacityUnits: SafeInt,
): {
  accepted: readonly CarrierCapacityAssignment[];
  rejected: readonly CarrierCapacityAssignment[];
  finalOccupied: SafeInt;
} {
  const sorted = [...assignments].sort(assignmentOrderComparator);
  let current = occupiedCapacityUnits;
  const accepted: CarrierCapacityAssignment[] = [];
  const rejected: CarrierCapacityAssignment[] = [];

  for (const a of sorted) {
    const next = SafeInt.add(current, a.capacityUnits);
    if (next <= physicalCapacityUnits) {
      accepted.push(a);
      current = next;
    } else {
      rejected.push(a);
    }
  }

  return { accepted, rejected, finalOccupied: current };
}

export interface OversizedCarrierPolicy {
  threshold: number;
  deckCycleEfficiencyBp: number;
  sortieGenerationBp: number;
  maintenanceCostBp: number;
  coordinationBp: number;
  hazardBp: number;
}

export const SHIPPED_OVERSIZED_POLICY: OversizedCarrierPolicy = {
  threshold: OVERSIZED_CARRIER_THRESHOLD,
  deckCycleEfficiencyBp: OVERSIZED_DECK_CYCLE_EFFICIENCY_BP,
  sortieGenerationBp: OVERSIZED_SORTIE_GENERATION_BP,
  maintenanceCostBp: OVERSIZED_MAINTENANCE_COST_BP,
  coordinationBp: OVERSIZED_COORDINATION_BP,
  hazardBp: OVERSIZED_HAZARD_BP,
};

export function isOversized(compiledAircraftCapacity: number): boolean {
  return compiledAircraftCapacity > OVERSIZED_CARRIER_THRESHOLD;
}

export function assertCarrierOperationsState(state: CarrierOperationsState): void {
  if (!state.shipId || typeof state.shipId !== "string") {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "shipId",
      reason: "missing or empty shipId",
      value: state.shipId,
    });
  }
  if (!state.compiledDesignId || typeof state.compiledDesignId !== "string") {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "compiledDesignId",
      reason: "missing or empty compiledDesignId",
      value: state.compiledDesignId,
    });
  }
  if (!(CARRIER_CLASSIFICATIONS as readonly string[]).includes(state.classification)) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "classification",
      reason: `invalid classification: ${state.classification}`,
      value: state.classification,
    });
  }
  if (!SafeInt.isSafeInt(state.physicalCapacityUnits) || Number(state.physicalCapacityUnits) < 0) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "physicalCapacityUnits",
      reason: "physicalCapacityUnits must be a non-negative SafeInt",
      value: state.physicalCapacityUnits,
    });
  }
  if (!SafeInt.isSafeInt(state.occupiedCapacityUnits) || Number(state.occupiedCapacityUnits) < 0) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "occupiedCapacityUnits",
      reason: "occupiedCapacityUnits must be a non-negative SafeInt",
      value: state.occupiedCapacityUnits,
    });
  }
  if (Number(state.occupiedCapacityUnits) > Number(state.physicalCapacityUnits)) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "occupiedCapacityUnits",
      reason: "occupied exceeds physical capacity",
      value: state.occupiedCapacityUnits,
    });
  }
  if (!SafeInt.isSafeInt(state.currentSpotValue) || Number(state.currentSpotValue) < 0) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "currentSpotValue",
      reason: "currentSpotValue must be a non-negative SafeInt",
      value: state.currentSpotValue,
    });
  }
  if (!(DECK_CYCLE_STATES as readonly string[]).includes(state.deckCycleState)) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "deckCycleState",
      reason: `invalid deck cycle state: ${state.deckCycleState}`,
      value: state.deckCycleState,
    });
  }
  if (state.rulesetVersion !== CARRIER_OPERATIONS_RULESET_VERSION) {
    throw new BluewaveError(INVALID_CARRIER_OPERATIONS_STATE, {
      code: INVALID_CARRIER_OPERATIONS_STATE,
      field: "rulesetVersion",
      reason: `ruleset version must be ${CARRIER_OPERATIONS_RULESET_VERSION}`,
      value: state.rulesetVersion,
    });
  }
}
