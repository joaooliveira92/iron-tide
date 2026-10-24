import { SafeInt } from "@bluewave/contracts";
import {
  CARRIER_CLASSIFICATIONS,
  CARRIER_OPERATIONS_FORMULA_VERSION,
  CARRIER_OPERATIONS_RULESET_VERSION,
  DECK_CYCLE_STATES,
} from "./constants.js";
import type {
  CarrierCapacityAssignmentContract,
  CarrierDeckContentionContract,
  CarrierDeckCycleStateContract,
  CarrierHazardExposureContract,
  CarrierLaunchRateContract,
  CarrierNightRecoveryContract,
  CarrierOperationsStateContract,
  CarrierOrdnanceStateContract,
  CarrierRecoveryPriorityContract,
  CarrierStrikeStateContract,
  CarrierWeatherSuspensionContract,
  CarrierWindOverDeckContract,
  OversizedCarrierPolicyContract,
} from "./contracts.js";
import { SHIPPED_OVERSIZED_POLICY } from "./model.js";

export function makeValidCarrierOperationsState_v1(): CarrierOperationsStateContract {
  return {
    shipId: "contract_witness",
    compiledDesignId: "contract_witness_design",
    classification: CARRIER_CLASSIFICATIONS[0],
    physicalCapacityUnits: SafeInt(0),
    occupiedCapacityUnits: SafeInt(0),
    currentSpotValue: SafeInt(0),
    deckCycleState: DECK_CYCLE_STATES[0],
    deckConfigurationId: "contract_witness_deck",
    catapultDefinitions: [],
    liftDefinitions: [],
    flightDeckCondition: 0,
    hangarCondition: 0,
    aviationFuelState: { fuelRemainingBp: SafeInt(0), fuelCapacityBp: SafeInt(0) },
    ordnanceInventory: [],
    assignedAirGroupSquadronIds: [],
    spottedAircraftCount: SafeInt(0),
    fueledAircraftCount: SafeInt(0),
    armedAircraftCount: SafeInt(0),
    airborneAircraftCount: SafeInt(0),
    returningAircraftCount: SafeInt(0),
    damagedAircraftCount: SafeInt(0),
    activeLaunchReservations: [],
    activeRecoveryReservations: [],
    weatherOperabilityState: {
      currentSeaState: SafeInt(0),
      windOverDeckKnots: SafeInt(0),
      precipitationIntensityBp: 0,
      visibilityNauticalMiles: SafeInt(0),
      deckFireIntensityBp: 0,
      nightOperationsActive: false,
    },
    rulesetVersion: CARRIER_OPERATIONS_RULESET_VERSION,
    formulaVersion: CARRIER_OPERATIONS_FORMULA_VERSION,
    stateHash: "contract_witness",
  };
}

export function makeValidCarrierCapacityAssignment_v1(): CarrierCapacityAssignmentContract {
  return {
    assignments: [],
    physicalCapacityUnits: SafeInt(0),
    occupiedCapacityUnits: SafeInt(0),
  };
}

export function makeValidOversizedCarrierPolicy_v1(): OversizedCarrierPolicyContract {
  return SHIPPED_OVERSIZED_POLICY;
}

export function makeValidCarrierDeckCycleState_v1(): CarrierDeckCycleStateContract {
  return {
    fromState: DECK_CYCLE_STATES[0],
    toState: DECK_CYCLE_STATES[0],
    timestamp: 0,
    transitionValidated: false,
  };
}

export function makeValidCarrierDeckContention_v1(): CarrierDeckContentionContract {
  return {
    requested: "EMERGENCY_RECOVERY",
    currentOperations: [],
    predicates: {
      hasAngledDeck: false,
      deckDamagePermitsOverlap: false,
      weatherPermitsOverlap: false,
      trafficPermitsOverlap: false,
      hasFueledArmedAircraftOnDeck: false,
      clearDeckCapacitySufficient: false,
    },
    permitted: false,
  };
}

export function makeValidCarrierStrikeState_v1(): CarrierStrikeStateContract {
  return {
    strikeId: "contract_witness_strike",
    originCarrierIds: [],
    targetReportId: "contract_witness_target",
    targetConfidenceBp: 0,
    allocatedSquadrons: [],
    escortAllocationIds: [],
    loadoutId: "contract_witness_loadout",
    ordnanceReservations: [],
    coordinationMode: "UNCOORDINATED",
    readinessStartMinute: 0,
    plannedLaunchMinute: 0,
    actualLaunchMinute: 0,
    fuelRequirementBp: SafeInt(0),
    fuelReserveBp: SafeInt(0),
    spotValueRequirement: SafeInt(0),
    formationState: "FORMING",
    missionState: "PREPARING",
    recoveryPlan: {
      returnCarrierId: "contract_witness_carrier",
      recoveryWindowStart: 0,
      recoveryWindowEnd: 0,
      fuelReserveBp: SafeInt(0),
      divertFieldIds: [],
    },
    rulesetVersion: CARRIER_OPERATIONS_RULESET_VERSION,
    strikeHash: "contract_witness",
  };
}

export function makeValidCarrierLaunchRate_v1(): CarrierLaunchRateContract {
  return {
    operationalCatapultCount: 0,
    usingSteamCatapults: false,
    isLightJet: false,
    isHeavyJet: false,
    isPiston: true,
    effectiveRate: 1,
    durationMinutes: 1,
    aircraftCount: 1,
  };
}

export function makeValidCarrierWindOverDeck_v1(): CarrierWindOverDeckContract {
  return {
    requiredCourse: { minDegrees: 0, maxDegrees: 360 },
    requiredSpeed: { minKnots: 0, maxKnots: 0 },
    windVector: {
      ambientWindSpeedKnots: 0,
      ambientWindDirectionDegrees: 0,
      carrierSpeedKnots: 0,
      carrierCourseDegrees: 0,
    },
    deckOperationId: "contract_witness_deck_operation",
    relativeWodKnots: 0,
    aircraftClass: "PISTON",
    isLaunch: false,
    wodSufficient: false,
  };
}

export function makeValidCarrierHazardExposure_v1(): CarrierHazardExposureContract {
  return {
    inputs: {
      fueledAircraftCount: SafeInt(0),
      armedAircraftCount: SafeInt(0),
      torpedoLoadedAircraftCount: SafeInt(0),
      guidedWeaponLoadedAircraftCount: SafeInt(0),
      fuelingTransferActive: false,
      ordnanceHandlingActive: false,
    },
    totalExposure: SafeInt(0),
  };
}

export function makeValidCarrierNightRecovery_v1(): CarrierNightRecoveryContract {
  return {
    predicates: {
      hasNightCarrierOperationsTech: false,
      hasOperationalDeckLighting: false,
      hasValidContact: false,
      windOverDeckKnots: 0,
      aircraftClass: "PISTON",
      weatherNotSuspended: false,
      carrierCommandAccepts: false,
      hasSufficientFuel: false,
      isEmergency: false,
    },
    eligible: false,
    lossBasisBp: 0,
  };
}

export function makeValidCarrierWeatherSuspension_v1(): CarrierWeatherSuspensionContract {
  return {
    predicates: {
      currentSeaState: SafeInt(0),
      windOverDeckKnots: SafeInt(0),
      aircraftClass: "PISTON",
      isLaunchOperation: false,
      isHeavyPrecipitation: false,
      isExtremePrecipitation: false,
      visibilityNauticalMiles: SafeInt(0),
      hasInstrumentLandingTechnology: false,
      deckFireIntensityBp: 0,
    },
    suspended: false,
    reason: "contract_witness",
  };
}

export function makeValidCarrierRecoveryPriority_v1(): CarrierRecoveryPriorityContract {
  return {
    requests: [],
    deckCapacityAvailable: SafeInt(0),
    requestedSlots: SafeInt(0),
    carrierHasAlternateLanding: false,
    sortedAircraftIds: [],
  };
}

export function makeValidCarrierOrdnanceState_v1(): CarrierOrdnanceStateContract {
  return {
    transactions: [],
    inventoryTypeId: "contract_witness_ordnance",
    availableQuantity: SafeInt(0),
    requestedQuantity: SafeInt(0),
    sufficient: false,
  };
}
