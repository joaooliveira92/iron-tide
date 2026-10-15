//packages/combat/src/air-combat/contracts.ts
// D-3 M4 Aviation: CAP & Strikes — AC-20 air_combat_v1 contract with 6-factor manifest.
// Parallel to aircraft/contracts.ts pattern.
import { BluewaveError } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import {
  AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
  AIR_COMBAT_DISRUPTION_MIN_BP,
  AIR_COMBAT_EXCHANGE_FACTOR_KEYS,
  AIR_COMBAT_FORMULA_VERSION,
  AIR_COMBAT_NUMERICAL_MIN_BP,
  AIR_COMBAT_RULESET_VERSION,
  AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
  AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
} from "./constants.js";
import { formatContractIssues } from "../schema-issues.js";
import { AIR_COMBAT_INVARIANT_FAILED } from "./reasonCodes.js";

export const AirCombatPolicy_v1 = Schema.Struct({
  rulesetVersion: Schema.Literal(AIR_COMBAT_RULESET_VERSION),
  formulaVersion: Schema.Literal(AIR_COMBAT_FORMULA_VERSION),
  basisPoints: Schema.Literal(AIR_COMBAT_BASIS_POINTS),
  factorKeys: Schema.Tuple([
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[0]),
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[1]),
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[2]),
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[3]),
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[4]),
    Schema.Literal(AIR_COMBAT_EXCHANGE_FACTOR_KEYS[5]),
  ]),
  disruptionMinBp: Schema.Literal(AIR_COMBAT_DISRUPTION_MIN_BP),
  altitudeNeutralBp: Schema.Literal(AIR_COMBAT_ALTITUDE_NEUTRAL_BP),
  altitudeAdvantageBp: Schema.Literal(AIR_COMBAT_ALTITUDE_ADVANTAGE_BP),
  altitudeDisadvantageBp: Schema.Literal(AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP),
  surpriseFirstPassBp: Schema.Literal(AIR_COMBAT_SURPRISE_FIRST_PASS_BP),
  surpriseSubsequentBp: Schema.Literal(AIR_COMBAT_SURPRISE_SUBSEQUENT_BP),
  numericalMinBp: Schema.Literal(AIR_COMBAT_NUMERICAL_MIN_BP),
  destroyedDamageRatioBp: Schema.Literal(AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP),
});

export type AirCombatPolicyContract = typeof AirCombatPolicy_v1.Type;

export function validateAirCombatContract(value: unknown): AirCombatPolicyContract {
  const result = Schema.decodeUnknownResult(AirCombatPolicy_v1)(value);
  if (Result.isFailure(result)) {
    const first = formatContractIssues(result.failure)[0];
    throw new BluewaveError(AIR_COMBAT_INVARIANT_FAILED, {
      code: AIR_COMBAT_INVARIANT_FAILED,
      field: first?.path ?? "unknown",
      reason: first?.message ?? "contract validation failed",
      value,
    });
  }
  return result.success;
}

export const SHIPPED_AIR_COMBAT_CONTRACT = {
  policy: AirCombatPolicy_v1,
} as const;
