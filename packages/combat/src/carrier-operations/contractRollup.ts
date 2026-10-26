import {
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
import {
  makeValidCarrierCapacityAssignment_v1,
  makeValidCarrierDeckContention_v1,
  makeValidCarrierDeckCycleState_v1,
  makeValidCarrierHazardExposure_v1,
  makeValidCarrierLaunchRate_v1,
  makeValidCarrierNightRecovery_v1,
  makeValidCarrierOperationsState_v1,
  makeValidCarrierOrdnanceState_v1,
  makeValidCarrierRecoveryPriority_v1,
  makeValidCarrierStrikeState_v1,
  makeValidCarrierWeatherSuspension_v1,
  makeValidCarrierWindOverDeck_v1,
  makeValidOversizedCarrierPolicy_v1,
} from "./contractWitnesses.js";

export interface CarrierOperationsContractEntry {
  policyId: string;
  shippedContract: unknown;
  validate: (value: unknown) => void;
}

export const SHIPPED_CARRIER_OPERATIONS_CONTRACTS: readonly CarrierOperationsContractEntry[] = [
  {
    policyId: "carrier_operations_state_v1",
    shippedContract: makeValidCarrierOperationsState_v1(),
    validate: validateCarrierOperationsStateContract,
  },
  {
    policyId: "carrier_capacity_assignment_v1",
    shippedContract: makeValidCarrierCapacityAssignment_v1(),
    validate: validateCarrierCapacityAssignmentContract,
  },
  {
    policyId: "oversized_carrier_policy_v1",
    shippedContract: makeValidOversizedCarrierPolicy_v1(),
    validate: validateOversizedCarrierPolicyContract,
  },
  {
    policyId: "carrier_deck_cycle_state_v1",
    shippedContract: makeValidCarrierDeckCycleState_v1(),
    validate: validateCarrierDeckCycleStateContract,
  },
  {
    policyId: "carrier_deck_contention_v1",
    shippedContract: makeValidCarrierDeckContention_v1(),
    validate: validateCarrierDeckContentionContract,
  },
  {
    policyId: "carrier_strike_state_v1",
    shippedContract: makeValidCarrierStrikeState_v1(),
    validate: validateCarrierStrikeStateContract,
  },
  {
    policyId: "carrier_launch_rate_v1",
    shippedContract: makeValidCarrierLaunchRate_v1(),
    validate: validateCarrierLaunchRateContract,
  },
  {
    policyId: "carrier_wind_over_deck_v1",
    shippedContract: makeValidCarrierWindOverDeck_v1(),
    validate: validateCarrierWindOverDeckContract,
  },
  {
    policyId: "carrier_hazard_exposure_v1",
    shippedContract: makeValidCarrierHazardExposure_v1(),
    validate: validateCarrierHazardExposureContract,
  },
  {
    policyId: "carrier_night_recovery_v1",
    shippedContract: makeValidCarrierNightRecovery_v1(),
    validate: validateCarrierNightRecoveryContract,
  },
  {
    policyId: "carrier_weather_suspension_v1",
    shippedContract: makeValidCarrierWeatherSuspension_v1(),
    validate: validateCarrierWeatherSuspensionContract,
  },
  {
    policyId: "carrier_recovery_priority_v1",
    shippedContract: makeValidCarrierRecoveryPriority_v1(),
    validate: validateCarrierRecoveryPriorityContract,
  },
  {
    policyId: "carrier_ordnance_state_v1",
    shippedContract: makeValidCarrierOrdnanceState_v1(),
    validate: validateCarrierOrdnanceStateContract,
  },
] as const;

export function validateAllCarrierOperationsContracts(): void {
  for (const entry of SHIPPED_CARRIER_OPERATIONS_CONTRACTS) {
    entry.validate(entry.shippedContract);
  }
}
