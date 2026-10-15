// packages/combat/src/air-defense/contractRollup.ts
// D-4 M4 Aviation: Air Defense — AC-17: every shipped air-defense contract in a single typed
// registry, plus a fail-closed validation guard.
// Parallel to air-combat/contractRollup.ts pattern.
//
// Registry order is the canonical contract order: the full ruleset manifest first, then the
// three sub-contracts (director scaling §12, radar saturation §14, CIWS redundancy §16).

import {
  AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
  AIR_DEFENSE_CONTRACT_POLICY_ID,
  AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
  AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
  makeValidAirDefensePolicy_v1,
  makeValidAaDirectorScalingPolicy_v1,
  makeValidRadarSaturationPolicy_v1,
  makeValidCiwsRedundancyPolicy_v1,
  validateAirDefenseContract,
  validateAaDirectorScalingContract,
  validateRadarSaturationContract,
  validateCiwsRedundancyContract,
} from "./contracts.js";

export interface AirDefenseContractEntry {
  policyId: string;
  shippedContract: unknown;
  validate: (value: unknown) => void;
}

export const SHIPPED_AIR_DEFENSE_CONTRACTS: readonly AirDefenseContractEntry[] = [
  {
    policyId: AIR_DEFENSE_CONTRACT_POLICY_ID,
    shippedContract: makeValidAirDefensePolicy_v1(),
    validate: validateAirDefenseContract,
  },
  {
    policyId: AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
    shippedContract: makeValidAaDirectorScalingPolicy_v1(),
    validate: validateAaDirectorScalingContract,
  },
  {
    policyId: AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
    shippedContract: makeValidRadarSaturationPolicy_v1(),
    validate: validateRadarSaturationContract,
  },
  {
    policyId: AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
    shippedContract: makeValidCiwsRedundancyPolicy_v1(),
    validate: validateCiwsRedundancyContract,
  },
] as const;

/** AC-17 gate: every shipped contract validates against its own pinned-literals schema. */
export function validateAllAirDefenseContracts(): void {
  for (const entry of SHIPPED_AIR_DEFENSE_CONTRACTS) {
    entry.validate(entry.shippedContract);
  }
}
