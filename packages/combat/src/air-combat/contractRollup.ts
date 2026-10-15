// D-3 M4 Aviation: CAP & Strikes — INC-7: every shipped air-combat contract in a single typed
// registry, plus a fail-closed validation guard.
// Parallel to aircraft/contractRollup.ts pattern.
import { type AirCombatPolicyContract, validateAirCombatContract } from "./contracts.js";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_EXCHANGE_FACTOR_KEYS,
  AIR_COMBAT_RULESET_VERSION,
  AIR_COMBAT_FORMULA_VERSION,
  AIR_COMBAT_DISRUPTION_MIN_BP,
  AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
  AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
  AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
  AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
  AIR_COMBAT_NUMERICAL_MIN_BP,
  AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
} from "./constants.js";

export interface AirCombatContractEntry {
  policyId: string;
  shippedContract: unknown;
  validate: (value: unknown) => void;
}

function makeValidAirCombatPolicy(): AirCombatPolicyContract {
  return {
    rulesetVersion: AIR_COMBAT_RULESET_VERSION,
    formulaVersion: AIR_COMBAT_FORMULA_VERSION,
    basisPoints: AIR_COMBAT_BASIS_POINTS,
    factorKeys: [...AIR_COMBAT_EXCHANGE_FACTOR_KEYS],
    disruptionMinBp: AIR_COMBAT_DISRUPTION_MIN_BP,
    altitudeNeutralBp: AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
    altitudeAdvantageBp: AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
    altitudeDisadvantageBp: AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
    surpriseFirstPassBp: AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
    surpriseSubsequentBp: AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
    numericalMinBp: AIR_COMBAT_NUMERICAL_MIN_BP,
    destroyedDamageRatioBp: AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
  };
}

export const SHIPPED_AIR_COMBAT_CONTRACTS: readonly AirCombatContractEntry[] = [
  {
    policyId: "air_combat_v1",
    shippedContract: makeValidAirCombatPolicy(),
    validate: validateAirCombatContract,
  },
] as const;

export function validateAllAirCombatContracts(): void {
  for (const entry of SHIPPED_AIR_COMBAT_CONTRACTS) {
    entry.validate(entry.shippedContract);
  }
}
