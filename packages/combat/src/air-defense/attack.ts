// packages/combat/src/air-defense/attack.ts
// D-4 M4 Aviation: Air Defense — AirDefenseAttack incoming attack model per DESIGN-45 §4.
// Every attack declares release range, release altitude, speed profile, terminal profile,
// formation size, cohesion, defensive susceptibility, and target identifier (§4 line 84).
// Strict validation at construction boundaries, fail-closed guards.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import { formatContractIssues } from "../schema-issues.js";
import { AIR_DEFENSE_MODEL_VERSION } from "./constants.js";
import { INVALID_AIR_DEFENSE_ATTACK } from "./reasonCodes.js";

// ---- Canonical attack types (§4) ----

export const AttackType = {
  AIRCRAFT_LEVEL_BOMBING: "AIRCRAFT_LEVEL_BOMBING" as const,
  AIRCRAFT_DIVE_BOMBING: "AIRCRAFT_DIVE_BOMBING" as const,
  AIRCRAFT_SKIP_BOMBING: "AIRCRAFT_SKIP_BOMBING" as const,
  AIRCRAFT_TORPEDO_ATTACK: "AIRCRAFT_TORPEDO_ATTACK" as const,
  AIRCRAFT_ROCKET_ATTACK: "AIRCRAFT_ROCKET_ATTACK" as const,
  AIRCRAFT_GUIDED_WEAPON_ATTACK: "AIRCRAFT_GUIDED_WEAPON_ATTACK" as const,
  HEAVY_ASM: "HEAVY_ASM" as const,
  MEDIUM_ASM: "MEDIUM_ASM" as const,
  LIGHT_ASM: "LIGHT_ASM" as const,
  ANTI_RADIATION_WEAPON: "ANTI_RADIATION_WEAPON" as const,
  SPECIAL_EXPLICIT_ATTACK: "SPECIAL_EXPLICIT_ATTACK" as const,
} as const;

export type AttackTypeId = (typeof AttackType)[keyof typeof AttackType];

/** All 11 canonical attack types, in §4 canonical order. */
export const ATTACK_TYPES: readonly AttackTypeId[] = [
  AttackType.AIRCRAFT_LEVEL_BOMBING,
  AttackType.AIRCRAFT_DIVE_BOMBING,
  AttackType.AIRCRAFT_SKIP_BOMBING,
  AttackType.AIRCRAFT_TORPEDO_ATTACK,
  AttackType.AIRCRAFT_ROCKET_ATTACK,
  AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK,
  AttackType.HEAVY_ASM,
  AttackType.MEDIUM_ASM,
  AttackType.LIGHT_ASM,
  AttackType.ANTI_RADIATION_WEAPON,
  AttackType.SPECIAL_EXPLICIT_ATTACK,
];

// ---- Attack-type literal ----

const AttackTypeLiteral = Schema.Literals([
  "AIRCRAFT_LEVEL_BOMBING",
  "AIRCRAFT_DIVE_BOMBING",
  "AIRCRAFT_SKIP_BOMBING",
  "AIRCRAFT_TORPEDO_ATTACK",
  "AIRCRAFT_ROCKET_ATTACK",
  "AIRCRAFT_GUIDED_WEAPON_ATTACK",
  "HEAVY_ASM",
  "MEDIUM_ASM",
  "LIGHT_ASM",
  "ANTI_RADIATION_WEAPON",
  "SPECIAL_EXPLICIT_ATTACK",
]);

/**
 * Standard SafeInt schema: accept a number, validate integer + safe range. The
 * `message` is surfaced verbatim on failure, matching the previous Zod custom
 * schema's `{ message }` behavior.
 *
 * The decoded value carries the `@bluewave/contracts` `SafeInt` brand at the
 * schema seam. `Schema.brand` mints Effect's own brand (`Brand.Brand<"SafeInt">`,
 * a `[BrandTypeId]` symbol), which is not the contracts brand
 * (`{ readonly __brand: "SafeInt" }`), so the nominal type is annotated here
 * instead — the runtime contract is unchanged (a validated integer; `Encoded`
 * stays `number`) and no call site needs a narrowing cast (ticket INC-3).
 */
function safeIntSchema(
  message: string,
  opts?: { min?: number; max?: number; nonNegative?: boolean; positive?: boolean },
): Schema.Codec<SafeInt, number> {
  return Schema.Finite.check(
    Schema.makeFilter((val: number) => {
      if (!SafeInt.isSafeInt(val)) return message;
      if (opts?.positive && !(val > 0)) return message;
      if (opts?.nonNegative && !(val >= 0)) return message;
      if (opts?.min !== undefined && val < opts.min) return message;
      if (opts?.max !== undefined && val > opts.max) return message;
      return undefined;
    }),
  ) as Schema.Codec<SafeInt, number>;
}

// ---- AirDefenseAttack interface (§4) ----

export interface AirDefenseAttack {
  attackId: string;
  formationId: string; // attacking formation identifier (must be provided)
  targetId: string; // defended ship identifier under attack
  attackType: AttackTypeId;
  speedKnots: SafeInt;
  speedMps: SafeInt;
  currentRangeM: SafeInt; // range to the defended ship / closest approach
  currentAltitudeM: SafeInt;
  bearingDegrees: SafeInt; // 0..360 angular offset from the defender-facing line (arc predicate)
  releaseRangeM: SafeInt;
  releaseAltitudeM: SafeInt;
  isReleased: boolean; // weapons released from the aircraft? (§8 pre-release vs post-release)
  fireControlSolutionBp: SafeInt; // current fire-control solution in basis points (§8 gate)
  timeToImpactMs: SafeInt; // time to impact / closest approach (light-AA window §9)
  formationSize: SafeInt; // positive
  cohesionBp: SafeInt;
  defensiveSusceptibilityBp: SafeInt;
  contentVersion: string;
  contentHash: string;
}

// ---- Effect Schema for AirDefenseAttack (strict: unknown fields rejected) ----

const AirDefenseAttackSchema = Schema.Struct({
  attackId: Schema.String.check(
    Schema.isMinLength(1, { message: "attackId must be a non-empty string" }),
  ),

  formationId: Schema.String.check(
    Schema.isMinLength(1, { message: "formationId must be a non-empty string" }),
  ),

  targetId: Schema.String.check(
    Schema.isMinLength(1, { message: "targetId must be a non-empty string" }),
  ),

  attackType: AttackTypeLiteral,

  speedKnots: safeIntSchema("speedKnots must be a non-negative integer", { nonNegative: true }),

  speedMps: safeIntSchema("speedMps must be a non-negative integer", { nonNegative: true }),

  currentRangeM: safeIntSchema("currentRangeM must be a non-negative integer", {
    nonNegative: true,
  }),

  currentAltitudeM: safeIntSchema("currentAltitudeM must be a non-negative integer", {
    nonNegative: true,
  }),

  bearingDegrees: safeIntSchema("bearingDegrees must be 0-360", { min: 0, max: 360 }),

  releaseRangeM: safeIntSchema("releaseRangeM must be a non-negative integer", {
    nonNegative: true,
  }),

  releaseAltitudeM: safeIntSchema("releaseAltitudeM must be a non-negative integer", {
    nonNegative: true,
  }),

  isReleased: Schema.Boolean,

  fireControlSolutionBp: safeIntSchema("fireControlSolutionBp must be a non-negative integer", {
    nonNegative: true,
  }),

  timeToImpactMs: safeIntSchema("timeToImpactMs must be a non-negative integer", {
    nonNegative: true,
  }),

  formationSize: safeIntSchema("formationSize must be a positive integer", { positive: true }),

  cohesionBp: safeIntSchema("cohesionBp must be a non-negative integer", {
    nonNegative: true,
  }),

  defensiveSusceptibilityBp: safeIntSchema(
    "defensiveSusceptibilityBp must be a non-negative integer",
    { nonNegative: true },
  ),

  contentVersion: Schema.String.check(
    Schema.isMinLength(1, { message: "contentVersion must be a non-empty string" }),
  ),

  contentHash: Schema.String.check(
    Schema.isBetweenLength(64, 64, {
      message: "contentHash must be a 64-character SHA-256 hex string",
    }),
  ),
});

/**
 * Strict + collect-all options: unmodeled keys are rejected and every failing
 * field is reported, matching the previous Zod `.strict().safeParse()` which
 * surfaced the full `issue` list. `onExcessProperty` is a parse-time option in
 * Effect v4 (it cannot be embedded in the schema AST), so decoding is
 * centralized through `validateAirDefenseAttack`.
 */
const parseOptions = { onExcessProperty: "error", errors: "all" } as const;

// ---- fail-closed guard: rejects unknown fields ----

export function validateAirDefenseAttack(value: unknown): AirDefenseAttack {
  const result = Schema.decodeUnknownResult(AirDefenseAttackSchema, parseOptions)(value);
  if (Result.isFailure(result)) {
    const errors = formatContractIssues(result.failure).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    throw new BluewaveError(
      `AirDefenseAttack validation failed: ${JSON.stringify(errors, null, 2)}`,
      {
        code: INVALID_AIR_DEFENSE_ATTACK,
        errors,
      },
    );
  }
  return result.success;
}

// ---- createAirDefenseAttack ----

/**
 * Only `undefined` selects a default. The pre-migration Zod `.partial()` pass
 * accepted `undefined` for an omitted field but rejected a supplied `null`;
 * using `??` would silently turn `null` into the default, so a supplied `null`
 * must flow to the schema and fail closed like any other invalid value.
 */
function withDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function createAirDefenseAttack(params: Partial<AirDefenseAttack>): AirDefenseAttack {
  // `params` is typed non-null but JS callers can pass `undefined`; normalizing to `{}`
  // keeps the unknown-field scan below from throwing a raw TypeError, so an empty input
  // fails closed through `validateAirDefenseAttack` as a BluewaveError (12-F2 parity).
  const input = params ?? {};

  // Fail-closed on unknown fields: the defaults merge below only carries known
  // keys, so unknown input keys are rejected here rather than silently dropped.
  const knownKeys = new Set(Object.keys(AirDefenseAttackSchema.fields));
  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) {
      throw new BluewaveError(`AirDefenseAttack validation failed: unknown field "${key}"`, {
        code: INVALID_AIR_DEFENSE_ATTACK,
        field: key,
      });
    }
  }

  const merged = {
    attackId: withDefault(input.attackId, ""),
    formationId: withDefault(input.formationId, ""),
    targetId: withDefault(input.targetId, ""),
    attackType: withDefault(input.attackType, AttackType.AIRCRAFT_LEVEL_BOMBING),
    speedKnots: withDefault(input.speedKnots, SafeInt.ZERO),
    speedMps: withDefault(input.speedMps, SafeInt.ZERO),
    currentRangeM: withDefault(input.currentRangeM, SafeInt.ZERO),
    currentAltitudeM: withDefault(input.currentAltitudeM, SafeInt.ZERO),
    bearingDegrees: withDefault(input.bearingDegrees, SafeInt.ZERO),
    releaseRangeM: withDefault(input.releaseRangeM, SafeInt.ZERO),
    releaseAltitudeM: withDefault(input.releaseAltitudeM, SafeInt.ZERO),
    isReleased: withDefault(input.isReleased, false),
    fireControlSolutionBp: withDefault(input.fireControlSolutionBp, SafeInt(10_000)),
    timeToImpactMs: withDefault(input.timeToImpactMs, SafeInt(120_000)),
    formationSize: withDefault(input.formationSize, SafeInt(1)),
    cohesionBp: withDefault(input.cohesionBp, SafeInt(10_000)),
    defensiveSusceptibilityBp: withDefault(input.defensiveSusceptibilityBp, SafeInt(10_000)),
    contentVersion: withDefault(input.contentVersion, AIR_DEFENSE_MODEL_VERSION),
    contentHash: withDefault(
      input.contentHash,
      "0000000000000000000000000000000000000000000000000000000000000000",
    ),
  };

  // Validate the merged result with the strict schema.
  return validateAirDefenseAttack(merged);
}

// ---- isValidAttackType ----

export function isValidAttackType(attackType: string): attackType is AttackTypeId {
  return ATTACK_TYPES.includes(attackType as AttackTypeId);
}
