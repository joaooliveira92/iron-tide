import { Schema } from "effect";
import {
  AIR_DEFENSE_BASIS_POINTS,
  AIR_DEFENSE_FORMULA_VERSION,
  AIR_DEFENSE_MODEL_VERSION,
  CIWS_REDUNDANCY_TABLE,
  DIRECTOR_SCALING_TABLE,
  DISRUPTION_MULTIPLIERS,
  FORMULA_DENOMINATOR,
  FORMULA_EXPONENT,
  FULL_DEFENSE_LAYER_ORDER,
  HEAVY_AA_PROTECTED_RADIUS_M,
  HEAVY_AA_PROTECTED_RADIUS_NM,
  LOCAL_CONTROL_MULTIPLIER_BP,
  MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP,
  RADAR_SATURATION_TABLE,
} from "./constants.js";
import { DIRECTOR_NORMAL_SCALING_CAP } from "./director-scaling.js";
import { ENGAGEMENT_FACTOR_SLOT_NAMES } from "./engagement.js";
import { DEFENSE_LAYER_ORDER } from "./layer-resolution.js";
import { decodeContract } from "../schema-issues.js";
import {
  AIR_DEFENSE_RULESET_VERSION,
  AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS,
} from "./air-defense-system-definition.js";
import {
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_REASON_CODES_VERSION,
  AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
} from "./reasonCodes.js";

export const AIR_DEFENSE_CONTRACT_POLICY_ID = "air_defense_v1" as const;
export const AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID = "aa_director_scaling_v1" as const;
export const AIR_DEFENSE_RADAR_SATURATION_POLICY_ID = "radar_saturation_v1" as const;
export const AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID = "ciws_redundancy_v1" as const;

type LiteralStringTuple<T extends readonly [string, ...string[]]> = {
  readonly [K in keyof T]: Schema.Literal<T[K]>;
};

type LiteralPairTuple<T extends readonly (readonly [number, number])[]> = {
  readonly [K in keyof T]: T[K] extends readonly [infer A extends number, infer B extends number]
    ? Schema.Tuple<[Schema.Literal<A>, Schema.Literal<B>]>
    : never;
};

function literalStringTuple<const T extends readonly [string, ...string[]]>(
  values: T,
): Schema.Tuple<LiteralStringTuple<T>> {
  return Schema.Tuple(values.map((v) => Schema.Literal(v)) as LiteralStringTuple<T>);
}

function literalPairTuple<const T extends readonly (readonly [number, number])[]>(
  rows: T,
): Schema.Tuple<LiteralPairTuple<T>> {
  return Schema.Tuple(
    rows.map(([a, b]) =>
      Schema.Tuple([Schema.Literal(a), Schema.Literal(b)]),
    ) as LiteralPairTuple<T>,
  );
}

type MutableStringTuple<T extends readonly string[]> = { -readonly [K in keyof T]: T[K] };

type MutablePairTuple<T extends readonly (readonly [number, number])[]> = {
  -readonly [K in keyof T]: T[K] extends readonly [infer A, infer B] ? [A, B] : never;
};

function copyStrings<T extends readonly string[]>(values: T): MutableStringTuple<T> {
  return [...values] as MutableStringTuple<T>;
}

function copyPairs<T extends readonly (readonly [number, number])[]>(rows: T): MutablePairTuple<T> {
  return rows.map((row) => [row[0], row[1]] as MutablePairTuple<T>[number]) as MutablePairTuple<T>;
}

export const DisruptionMultipliers_v1 = Schema.Struct({
  LIGHT: Schema.Struct({ accuracyBp: Schema.Literal(9_000), cohesionBp: Schema.Literal(9_500) }),
  MODERATE: Schema.Struct({ accuracyBp: Schema.Literal(7_500), cohesionBp: Schema.Literal(8_500) }),
  SEVERE: Schema.Struct({ accuracyBp: Schema.Literal(5_000), cohesionBp: Schema.Literal(6_500) }),
  MISSION_ABORT: Schema.Struct({ accuracyBp: Schema.Literal(0), cohesionBp: Schema.Literal(0) }),
});

export const AirDefensePolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_CONTRACT_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  formulaVersion: Schema.Literal(AIR_DEFENSE_FORMULA_VERSION),
  reasonCodesVersion: Schema.Literal(AIR_DEFENSE_REASON_CODES_VERSION),
  basisPoints: Schema.Literal(AIR_DEFENSE_BASIS_POINTS),
  layerOrder: literalStringTuple(FULL_DEFENSE_LAYER_ORDER),
  aaLayerOrder: literalStringTuple(DEFENSE_LAYER_ORDER),
  factorKeys: literalStringTuple(ENGAGEMENT_FACTOR_SLOT_NAMES),
  formulaDenominator: Schema.Literal(FORMULA_DENOMINATOR),
  formulaExponent: Schema.Literal(FORMULA_EXPONENT),
  floorOnce: Schema.Literal(true),
  directorScalingTable: literalPairTuple(DIRECTOR_SCALING_TABLE),
  radarSaturationTable: literalPairTuple(RADAR_SATURATION_TABLE),
  ciwsRedundancyTable: literalPairTuple(CIWS_REDUNDANCY_TABLE),
  disruptionMultipliers: DisruptionMultipliers_v1,
  guaranteedLightAaDisruption: Schema.Struct({ exactlyOneAuthoritativeSubstep: Schema.Literal(1) }),
  protectedRadiusNm: Schema.Literal(HEAVY_AA_PROTECTED_RADIUS_NM),
  protectedRadiusM: Schema.Literal(HEAVY_AA_PROTECTED_RADIUS_M),
  mediumAaFireControlMinimumBp: Schema.Literal(MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP),
  localControlMultiplierBp: Schema.Literal(LOCAL_CONTROL_MULTIPLIER_BP),
  systemDefinitionFieldKeys: literalStringTuple(AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS),
  reasonCodes: literalStringTuple(AIR_DEFENSE_SHIPPED_REASON_CODE_LIST),
});

export type AirDefensePolicyContract = typeof AirDefensePolicy_v1.Type;

export const AaDirectorScalingPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  normalScalingCap: Schema.Literal(DIRECTOR_NORMAL_SCALING_CAP),
  scalingTable: literalPairTuple(DIRECTOR_SCALING_TABLE),
});

export type AaDirectorScalingPolicyContract = typeof AaDirectorScalingPolicy_v1.Type;

export const RadarSaturationPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_RADAR_SATURATION_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  saturationTable: literalPairTuple(RADAR_SATURATION_TABLE),
});

export type RadarSaturationPolicyContract = typeof RadarSaturationPolicy_v1.Type;

export const CiwsRedundancyPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  redundancyTable: literalPairTuple(CIWS_REDUNDANCY_TABLE),
});

export type CiwsRedundancyPolicyContract = typeof CiwsRedundancyPolicy_v1.Type;

export function makeValidAirDefensePolicy_v1(): AirDefensePolicyContract {
  return {
    policyId: AIR_DEFENSE_CONTRACT_POLICY_ID,
    rulesetVersion: AIR_DEFENSE_RULESET_VERSION,
    formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
    reasonCodesVersion: AIR_DEFENSE_REASON_CODES_VERSION,
    basisPoints: AIR_DEFENSE_BASIS_POINTS,
    layerOrder: copyStrings(FULL_DEFENSE_LAYER_ORDER),
    aaLayerOrder: copyStrings(DEFENSE_LAYER_ORDER),
    factorKeys: copyStrings(ENGAGEMENT_FACTOR_SLOT_NAMES),
    formulaDenominator: FORMULA_DENOMINATOR,
    formulaExponent: FORMULA_EXPONENT,
    floorOnce: true,
    directorScalingTable: copyPairs(DIRECTOR_SCALING_TABLE),
    radarSaturationTable: copyPairs(RADAR_SATURATION_TABLE),
    ciwsRedundancyTable: copyPairs(CIWS_REDUNDANCY_TABLE),
    disruptionMultipliers: {
      LIGHT: {
        accuracyBp: DISRUPTION_MULTIPLIERS.LIGHT.accuracyBp,
        cohesionBp: DISRUPTION_MULTIPLIERS.LIGHT.cohesionBp,
      },
      MODERATE: {
        accuracyBp: DISRUPTION_MULTIPLIERS.MODERATE.accuracyBp,
        cohesionBp: DISRUPTION_MULTIPLIERS.MODERATE.cohesionBp,
      },
      SEVERE: {
        accuracyBp: DISRUPTION_MULTIPLIERS.SEVERE.accuracyBp,
        cohesionBp: DISRUPTION_MULTIPLIERS.SEVERE.cohesionBp,
      },
      MISSION_ABORT: {
        accuracyBp: DISRUPTION_MULTIPLIERS.MISSION_ABORT.accuracyBp,
        cohesionBp: DISRUPTION_MULTIPLIERS.MISSION_ABORT.cohesionBp,
      },
    },
    guaranteedLightAaDisruption: { exactlyOneAuthoritativeSubstep: 1 },
    protectedRadiusNm: HEAVY_AA_PROTECTED_RADIUS_NM,
    protectedRadiusM: HEAVY_AA_PROTECTED_RADIUS_M,
    mediumAaFireControlMinimumBp: MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP,
    localControlMultiplierBp: LOCAL_CONTROL_MULTIPLIER_BP,
    systemDefinitionFieldKeys: copyStrings(AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS),
    reasonCodes: copyStrings(AIR_DEFENSE_SHIPPED_REASON_CODE_LIST),
  };
}

export function makeValidAaDirectorScalingPolicy_v1(): AaDirectorScalingPolicyContract {
  return {
    policyId: AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
    rulesetVersion: AIR_DEFENSE_RULESET_VERSION,
    normalScalingCap: DIRECTOR_NORMAL_SCALING_CAP,
    scalingTable: copyPairs(DIRECTOR_SCALING_TABLE),
  };
}

export function makeValidRadarSaturationPolicy_v1(): RadarSaturationPolicyContract {
  return {
    policyId: AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
    rulesetVersion: AIR_DEFENSE_RULESET_VERSION,
    saturationTable: copyPairs(RADAR_SATURATION_TABLE),
  };
}

export function makeValidCiwsRedundancyPolicy_v1(): CiwsRedundancyPolicyContract {
  return {
    policyId: AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
    rulesetVersion: AIR_DEFENSE_RULESET_VERSION,
    redundancyTable: copyPairs(CIWS_REDUNDANCY_TABLE),
  };
}

function decodeAirDefenseContract<A>(
  schema: Schema.ConstraintDecoder<A, never>,
  policyId: string,
  value: unknown,
): A {
  return decodeContract(schema, AIR_DEFENSE_INVARIANT_FAILED, value, {
    message: `${policyId} contract validation failed`,
    context: { policyId },
    includeValue: false,
  });
}

export function validateAirDefenseContract(value: unknown): AirDefensePolicyContract {
  return decodeAirDefenseContract(AirDefensePolicy_v1, AIR_DEFENSE_CONTRACT_POLICY_ID, value);
}

export function validateAaDirectorScalingContract(value: unknown): AaDirectorScalingPolicyContract {
  return decodeAirDefenseContract(
    AaDirectorScalingPolicy_v1,
    AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
    value,
  );
}

export function validateRadarSaturationContract(value: unknown): RadarSaturationPolicyContract {
  return decodeAirDefenseContract(
    RadarSaturationPolicy_v1,
    AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
    value,
  );
}

export function validateCiwsRedundancyContract(value: unknown): CiwsRedundancyPolicyContract {
  return decodeAirDefenseContract(
    CiwsRedundancyPolicy_v1,
    AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
    value,
  );
}

export const SHIPPED_AIR_DEFENSE_CONTRACT = {
  modelVersion: AIR_DEFENSE_MODEL_VERSION,
  policyIds: [
    AIR_DEFENSE_CONTRACT_POLICY_ID,
    AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
    AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
    AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
  ] as const,
} as const;
