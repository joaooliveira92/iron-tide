import {
  SHIPPED_CARRIER_OPERATIONS_CONTRACT,
  validateCarrierOperationsStateContract,
  validateCarrierCapacityAssignmentContract,
  validateOversizedCarrierPolicyContract,
  validateCarrierDeckCycleStateContract,
  validateCarrierDeckContentionContract,
  validateCarrierStrikeStateContract,
  validateCarrierLaunchRateContract,
  validateCarrierWindOverDeckContract,
  validateCarrierHazardExposureContract,
  validateCarrierNightRecoveryContract,
  validateCarrierWeatherSuspensionContract,
  validateCarrierRecoveryPriorityContract,
  validateCarrierOrdnanceStateContract,
} from "./contracts.js";

export interface CarrierOperationsContractEntry {
  policyId: string;
  shippedContract: unknown;
  validate: (value: unknown) => void;
}

export const SHIPPED_CARRIER_OPERATIONS_CONTRACTS: readonly CarrierOperationsContractEntry[] = [
  {
    policyId: "carrier_operations_state_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.state,
    validate: validateCarrierOperationsStateContract,
  },
  {
    policyId: "carrier_capacity_assignment_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.capacityAssignment,
    validate: validateCarrierCapacityAssignmentContract,
  },
  {
    policyId: "oversized_carrier_policy_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.oversizedPolicy,
    validate: validateOversizedCarrierPolicyContract,
  },
  {
    policyId: "carrier_deck_cycle_state_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.deckCycleState,
    validate: validateCarrierDeckCycleStateContract,
  },
  {
    policyId: "carrier_deck_contention_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.deckContention,
    validate: validateCarrierDeckContentionContract,
  },
  {
    policyId: "carrier_strike_state_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.strikeState,
    validate: validateCarrierStrikeStateContract,
  },
  {
    policyId: "carrier_launch_rate_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.launchRate,
    validate: validateCarrierLaunchRateContract,
  },
  {
    policyId: "carrier_wind_over_deck_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.windOverDeck,
    validate: validateCarrierWindOverDeckContract,
  },
  {
    policyId: "carrier_hazard_exposure_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.hazardExposure,
    validate: validateCarrierHazardExposureContract,
  },
  {
    policyId: "carrier_night_recovery_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.nightRecovery,
    validate: validateCarrierNightRecoveryContract,
  },
  {
    policyId: "carrier_weather_suspension_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.weatherSuspension,
    validate: validateCarrierWeatherSuspensionContract,
  },
  {
    policyId: "carrier_recovery_priority_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.recoveryPriority,
    validate: validateCarrierRecoveryPriorityContract,
  },
  {
    policyId: "carrier_ordnance_state_v1",
    shippedContract: SHIPPED_CARRIER_OPERATIONS_CONTRACT.ordnanceState,
    validate: validateCarrierOrdnanceStateContract,
  },
] as const;

export function validateAllCarrierOperationsContracts(): void {
  for (const entry of SHIPPED_CARRIER_OPERATIONS_CONTRACTS) {
    entry.validate(entry.shippedContract);
  }
}
