// D-4 M4 Aviation: Air Defense — AC-17 versioned contracts (fail-closed literals).
// Parallel to air-combat/contracts.ts pattern.
//
// Four shipped contracts (registry order in contractRollup.js):
//   air_defense_v1           — the full ruleset manifest (layers, formula, tables, disruption,
//                               §29.8 guaranteed light-AA disruption policy, §7/§8/§21 anchors,
//                               §3 system-definition schema keys, §28 reason-code catalog);
//   aa_director_scaling_v1   — §12 director scaling table + shipped normal-scaling cap;
//   radar_saturation_v1      — §14 radar-directed medium-AA marginal saturation table;
//   ciws_redundancy_v1       — §16 CIWS marginal redundancy table.
//
// Every schema is a strict object whose values are LITERALS pinned to the shipped
// constants; the shipped value factories build the exact same values FROM those constants,
// so the acceptance gate (validateAllAirDefenseContracts + the pinned golden hash) proves
// the schema and the shipped content can never silently drift apart.

import { BluewaveError } from "@bluewave/contracts";
import { Result, Schema } from "effect";
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
import { formatContractIssues } from "../schema-issues.js";
import {
  AIR_DEFENSE_RULESET_VERSION,
  AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS,
} from "./air-defense-system-definition.js";
import {
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_REASON_CODES_VERSION,
  AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
} from "./reasonCodes.js";

// Effect v4 cannot embed excess-property rejection in a schema AST: `onExcessProperty`
// is a parse-time option only (SchemaAST.ParseOptions: "schema annotations do not override
// them"). The policy schemas below are exported to preserve `@bluewave/combat`'s public
// surface (the pre-migration Zod schemas were exported), but strict excess-property
// rejection is NOT part of the schema AST: every public decode path goes through the
// `validate*Contract` guards, which pass this option. Decoding a bare policy schema without
// it silently strips excess keys instead of failing closed — the behavior the previous Zod
// `.strict()` provided.
const parseOptions = { onExcessProperty: "error" } as const;

// ---- Policy ids ----

export const AIR_DEFENSE_CONTRACT_POLICY_ID = "air_defense_v1" as const;
export const AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID = "aa_director_scaling_v1" as const;
export const AIR_DEFENSE_RADAR_SATURATION_POLICY_ID = "radar_saturation_v1" as const;
export const AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID = "ciws_redundancy_v1" as const;

// ---- Tuple-of-literals schema builders ----
// Build strict literal tuples straight from the `as const` shipped constants, so the schema
// can never name a value the shipped sources do not contain (and vice versa). The mapped
// tuple types preserve positional literal types across the dynamic `.map`, which TypeScript
// widens to an array; `Schema.Tuple` has no variadic tuple inference from a mapped array, so
// one narrowed assertion bridges the array back to the exact tuple type. The runtime value is
// the same schema array in the same order, so the value and the asserted type cannot diverge.
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

// ---- Mutable copy builders for the SHIPPED values (same shape as the tuple schemas) ----
// The contract values are plain mutable tuples/pairs whose literals come from the constants.

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

// ---- Disruption multiplier pairs (§6) ----

/** Exact §6 severity multiplier pairs (accuracy, cohesion) in basis points. */
export const DisruptionMultipliers_v1 = Schema.Struct({
  LIGHT: Schema.Struct({ accuracyBp: Schema.Literal(9_000), cohesionBp: Schema.Literal(9_500) }),
  MODERATE: Schema.Struct({ accuracyBp: Schema.Literal(7_500), cohesionBp: Schema.Literal(8_500) }),
  SEVERE: Schema.Struct({ accuracyBp: Schema.Literal(5_000), cohesionBp: Schema.Literal(6_500) }),
  MISSION_ABORT: Schema.Struct({ accuracyBp: Schema.Literal(0), cohesionBp: Schema.Literal(0) }),
});

// ---- air_defense_v1 ----

/**
 * The `air_defense_v1` manifest schema. Exported for public-surface parity (the
 * pre-migration Zod schema was exported); strict excess-property rejection is
 * enforced by `validateAirDefenseContract` via `onExcessProperty: "error"`, which
 * cannot be embedded in the schema AST.
 */
export const AirDefensePolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_CONTRACT_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  formulaVersion: Schema.Literal(AIR_DEFENSE_FORMULA_VERSION),
  reasonCodesVersion: Schema.Literal(AIR_DEFENSE_REASON_CODES_VERSION),
  basisPoints: Schema.Literal(AIR_DEFENSE_BASIS_POINTS),
  /** §1 full 8-layer order (CAP … CIWS_TERMINAL_DEFENSE) — also the §27.2 ordering key. */
  layerOrder: literalStringTuple(FULL_DEFENSE_LAYER_ORDER),
  /** The shipped 4-layer AA resolution subset (layer-resolution.js). */
  aaLayerOrder: literalStringTuple(DEFENSE_LAYER_ORDER),
  /** §19 nine-factor product order (engagement.js ENGAGEMENT_FACTOR_SLOT_NAMES). */
  factorKeys: literalStringTuple(ENGAGEMENT_FACTOR_SLOT_NAMES),
  formulaDenominator: Schema.Literal(FORMULA_DENOMINATOR),
  formulaExponent: Schema.Literal(FORMULA_EXPONENT),
  /** §19 line 326: the exact rational product MUST be rounded once with FLOOR. */
  floorOnce: Schema.Literal(true),
  directorScalingTable: literalPairTuple(DIRECTOR_SCALING_TABLE),
  radarSaturationTable: literalPairTuple(RADAR_SATURATION_TABLE),
  ciwsRedundancyTable: literalPairTuple(CIWS_REDUNDANCY_TABLE),
  disruptionMultipliers: DisruptionMultipliers_v1,
  /** §29.8: every eligible light-AA system receives at least one disruption check of one
   *  authoritative substep — the shipped policy grants exactly one substep. */
  guaranteedLightAaDisruption: Schema.Struct({ exactlyOneAuthoritativeSubstep: Schema.Literal(1) }),
  /** §7: heavy AA protects its own ship and nearby ships only within exactly five nm. */
  protectedRadiusNm: Schema.Literal(HEAVY_AA_PROTECTED_RADIUS_NM),
  protectedRadiusM: Schema.Literal(HEAVY_AA_PROTECTED_RADIUS_M),
  /** §8: medium AA may engage only when the fire-control solution is at least 4_000 bp. */
  mediumAaFireControlMinimumBp: Schema.Literal(MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP),
  /** §21: intact gun + destroyed director → local control at exactly 5_000 bp when supported. */
  localControlMultiplierBp: Schema.Literal(LOCAL_CONTROL_MULTIPLIER_BP),
  /** §3: the exact system-definition schema key surface (ADR-0042 decision 12). */
  systemDefinitionFieldKeys: literalStringTuple(AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS),
  /** §28: the exact 20-code reason catalog in §28 document order. */
  reasonCodes: literalStringTuple(AIR_DEFENSE_SHIPPED_REASON_CODE_LIST),
});

export type AirDefensePolicyContract = typeof AirDefensePolicy_v1.Type;

// ---- aa_director_scaling_v1 ----

export const AaDirectorScalingPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  /** §12 shipped normal-scaling cap — exactly 4 (the last scaling-table row). */
  normalScalingCap: Schema.Literal(DIRECTOR_NORMAL_SCALING_CAP),
  scalingTable: literalPairTuple(DIRECTOR_SCALING_TABLE),
});

export type AaDirectorScalingPolicyContract = typeof AaDirectorScalingPolicy_v1.Type;

// ---- radar_saturation_v1 ----

export const RadarSaturationPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_RADAR_SATURATION_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  /** §14 marginal schedule: 1-4 → 10_000, 5-6 → 5_000, 7-8 → 2_500, 9+ → 500. */
  saturationTable: literalPairTuple(RADAR_SATURATION_TABLE),
});

export type RadarSaturationPolicyContract = typeof RadarSaturationPolicy_v1.Type;

// ---- ciws_redundancy_v1 ----

export const CiwsRedundancyPolicy_v1 = Schema.Struct({
  policyId: Schema.Literal(AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID),
  rulesetVersion: Schema.Literal(AIR_DEFENSE_RULESET_VERSION),
  /** §16 marginal schedule: 1-4 → 10_000, 5-6 → 5_000, 7-8 → 1_500, 9+ → 500. */
  redundancyTable: literalPairTuple(CIWS_REDUNDANCY_TABLE),
});

export type CiwsRedundancyPolicyContract = typeof CiwsRedundancyPolicy_v1.Type;

// ---- Shipped value factories (built FROM the constants) ----

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

// ---- Fail-closed validate*Contract guards ----
// Every validator throws a BluewaveError tagged with the canonical §28 invariant code when
// the value deviates from the pinned literals — never clamps, never silently accepts.

function contractFailure(policyId: string, error: Schema.SchemaError): BluewaveError {
  const first = formatContractIssues(error)[0];
  return new BluewaveError(`${policyId} contract validation failed`, {
    code: AIR_DEFENSE_INVARIANT_FAILED,
    policyId,
    field: first?.path ?? "unknown",
    reason: first?.message ?? "contract validation failed",
  });
}

export function validateAirDefenseContract(value: unknown): AirDefensePolicyContract {
  const result = Schema.decodeUnknownResult(AirDefensePolicy_v1, parseOptions)(value);
  if (Result.isFailure(result))
    throw contractFailure(AIR_DEFENSE_CONTRACT_POLICY_ID, result.failure);
  return result.success;
}

export function validateAaDirectorScalingContract(value: unknown): AaDirectorScalingPolicyContract {
  const result = Schema.decodeUnknownResult(AaDirectorScalingPolicy_v1, parseOptions)(value);
  if (Result.isFailure(result))
    throw contractFailure(AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID, result.failure);
  return result.success;
}

export function validateRadarSaturationContract(value: unknown): RadarSaturationPolicyContract {
  const result = Schema.decodeUnknownResult(RadarSaturationPolicy_v1, parseOptions)(value);
  if (Result.isFailure(result))
    throw contractFailure(AIR_DEFENSE_RADAR_SATURATION_POLICY_ID, result.failure);
  return result.success;
}

export function validateCiwsRedundancyContract(value: unknown): CiwsRedundancyPolicyContract {
  const result = Schema.decodeUnknownResult(CiwsRedundancyPolicy_v1, parseOptions)(value);
  if (Result.isFailure(result))
    throw contractFailure(AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID, result.failure);
  return result.success;
}

// ---- Shipped contract schemas (mirrors air-combat SHIPPED_AIR_COMBAT_CONTRACT) ----
// MODEL_VERSION ties the manifest to the shipped content version; the four policy ids are
// the registry keys used by the contract rollup.
export const SHIPPED_AIR_DEFENSE_CONTRACT = {
  modelVersion: AIR_DEFENSE_MODEL_VERSION,
  policyIds: [
    AIR_DEFENSE_CONTRACT_POLICY_ID,
    AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
    AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
    AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
  ] as const,
} as const;
