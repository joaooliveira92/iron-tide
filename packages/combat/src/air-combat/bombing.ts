// D-3 M4 Aviation: CAP & Strikes — INC-4 (AC-9, AC-10, AC-11): transit time, bombing accuracy, dive/level bombing.
// Pure deterministic functions — no I/O, no random, no Date.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_BOMBING_ALTITUDE_HIGH_BP,
  AIR_COMBAT_BOMBING_ALTITUDE_MEDIUM_BP,
  AIR_COMBAT_BOMBING_ALTITUDE_LOW_BP,
  AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP,
  AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP,
  AIR_COMBAT_PAYLOAD_FACTOR_MULTIPLIER,
  AIR_COMBAT_PAYLOAD_FACTOR_MIN_BP,
  AIR_COMBAT_PAYLOAD_FACTOR_MAX_BP,
} from "./constants.js";
import { AIR_COMBAT_BOMBING_PARAMETERS_INVALID } from "./reasonCodes.js";

export type BombingAltitude = "HIGH" | "MEDIUM" | "LOW";

/**
 * Computes the transit time in minutes for a strike formation to reach its target.
 *
 * Formula: minutes = ceil(distanceM / max(1, speedMps * 60))
 *
 * @param distanceM - Distance to target in meters (SafeInt, non-negative).
 * @param speedMps - Formation speed (slowest aircraft) in meters per second (SafeInt, positive).
 * @returns Transit time in minutes (SafeInt).
 * @throws BluewaveError with AIR_COMBAT_BOMBING_PARAMETERS_INVALID if speedMps is negative.
 */
export function computeTransitTimeMinutes(distanceM: SafeInt, speedMps: SafeInt): SafeInt {
  if (Number(distanceM) < 0) {
    throw new BluewaveError(AIR_COMBAT_BOMBING_PARAMETERS_INVALID, {
      code: AIR_COMBAT_BOMBING_PARAMETERS_INVALID,
      distanceM: Number(distanceM),
      speedMps: Number(speedMps),
      reason: "distanceM must be non-negative",
    });
  }

  if (Number(speedMps) < 0) {
    throw new BluewaveError(AIR_COMBAT_BOMBING_PARAMETERS_INVALID, {
      code: AIR_COMBAT_BOMBING_PARAMETERS_INVALID,
      distanceM: Number(distanceM),
      speedMps: Number(speedMps),
      reason: "speedMps must be non-negative",
    });
  }

  // If already at target, transit time is 0
  if (Number(distanceM) === 0) {
    return SafeInt.ZERO;
  }

  // speedPerMinute = speedMps * 60
  const speedPerMinute = SafeInt.mul(speedMps, SafeInt(60));

  // Ensure denominator is at least 1 to avoid division by zero
  const denominator = Number(speedPerMinute) < 1 ? SafeInt.ONE : speedPerMinute;

  // minutes = ceil(distanceM / denominator)
  return SafeInt.div(distanceM, denominator, "ceil");
}

export interface BombingAccuracyParams {
  /** Base accuracy in basis points: 10_000 for level, 22_500 for dive */
  baseAccuracyBp: SafeInt;
  /** Payload capacity from aircraft model (kg or abstract units) */
  payloadCapacity: SafeInt;
  /** Visibility modifier in basis points (10_000 = clear, down to 3_000) */
  visibilityBp: SafeInt;
  /** Target maneuverability modifier in basis points */
  targetManeuverBp: SafeInt;
  /** Disruption modifier in basis points (from computeDisruption, range 5_000-10_000) */
  disruptionBp: SafeInt;
  /** Bombing altitude */
  altitude: BombingAltitude;
}

/**
 * Computes bombing accuracy as a composite of multiple factors.
 *
 * Formula:
 *   altitudePenaltyBp: HIGH=5_000, MEDIUM=8_500, LOW=10_000
 *   payloadFactorBp = clamp(1_000, 10_000, payloadCapacity * 50)
 *   numerator = baseAccuracyBp * altitudePenaltyBp * visibilityBp * targetManeuverBp * disruptionBp * payloadFactorBp
 *   denominator = 10_000^5
 *   accuracyBp = clamp(0, 10_000, numerator / denominator)
 *
 * Uses BigInt intermediate to avoid overflow.
 *
 * @param params - Bombing accuracy parameters.
 * @returns Accuracy in basis points (SafeInt, 0-10_000).
 * @throws BluewaveError with AIR_COMBAT_BOMBING_PARAMETERS_INVALID if any value is negative.
 */
export function computeBombingAccuracy(params: BombingAccuracyParams): SafeInt {
  // Validate all SafeInt parameters are non-negative
  validateBombingParams(params);

  // Altitude penalty
  const altitudePenaltyBp = getAltitudePenaltyBp(params.altitude);

  // Payload factor: heavier payload = better accuracy for area effect
  const rawPayloadFactor = SafeInt.mul(
    params.payloadCapacity,
    SafeInt(AIR_COMBAT_PAYLOAD_FACTOR_MULTIPLIER),
  );
  const payloadFactorBp = SafeInt(
    Math.max(
      AIR_COMBAT_PAYLOAD_FACTOR_MIN_BP,
      Math.min(AIR_COMBAT_PAYLOAD_FACTOR_MAX_BP, Number(rawPayloadFactor)),
    ),
  );

  // Use BigInt for multi-factor product to avoid overflow
  const numerator =
    BigInt(Number(params.baseAccuracyBp)) *
    BigInt(Number(altitudePenaltyBp)) *
    BigInt(Number(params.visibilityBp)) *
    BigInt(Number(params.targetManeuverBp)) *
    BigInt(Number(params.disruptionBp)) *
    BigInt(Number(payloadFactorBp));

  const denominator = BigInt(AIR_COMBAT_BASIS_POINTS) ** 5n;

  const accuracyBp = Number(numerator / denominator);

  // Clamp to [0, AIR_COMBAT_BASIS_POINTS]
  return SafeInt(Math.max(0, Math.min(AIR_COMBAT_BASIS_POINTS, accuracyBp)));
}

/**
 * Computes the bomb damage multiplier based on bombing type.
 * This is applied to the bomb's base damage for the armor penetration step.
 * The bomb's explosive mass is unchanged.
 *
 * @param isDiveBomb - Whether the attack is a dive bomb.
 * @returns Damage multiplier in basis points (SafeInt).
 */
export function computeBombDamageMultiplier(isDiveBomb: boolean): SafeInt {
  if (isDiveBomb) {
    return SafeInt(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
  }
  return SafeInt(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
}

/**
 * Computes the penetration multiplier for armor interaction.
 * Dive bombing has improved penetration vs level bombing of the same bomb mass.
 *
 * @param isDiveBomb - Whether the attack is a dive bomb.
 * @returns Penetration multiplier in basis points (SafeInt).
 */
export function computePenetrationMultiplier(isDiveBomb: boolean): SafeInt {
  if (isDiveBomb) {
    return SafeInt(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
  }
  return SafeInt(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
}

/**
 * Gets the altitude penalty in basis points.
 */
function getAltitudePenaltyBp(altitude: BombingAltitude): SafeInt {
  switch (altitude) {
    case "HIGH":
      return SafeInt(AIR_COMBAT_BOMBING_ALTITUDE_HIGH_BP);
    case "MEDIUM":
      return SafeInt(AIR_COMBAT_BOMBING_ALTITUDE_MEDIUM_BP);
    case "LOW":
      return SafeInt(AIR_COMBAT_BOMBING_ALTITUDE_LOW_BP);
  }
}

/**
 * Validates that all bombing parameters are non-negative and type-correct.
 *
 * @throws BluewaveError with AIR_COMBAT_BOMBING_PARAMETERS_INVALID if validation fails.
 */
function validateBombingParams(params: BombingAccuracyParams): void {
  const checks: { value: SafeInt | number; name: string }[] = [
    { value: params.baseAccuracyBp, name: "baseAccuracyBp" },
    { value: params.payloadCapacity, name: "payloadCapacity" },
    { value: params.visibilityBp, name: "visibilityBp" },
    { value: params.targetManeuverBp, name: "targetManeuverBp" },
    { value: params.disruptionBp, name: "disruptionBp" },
  ];

  for (const check of checks) {
    const num = Number(check.value);
    if (!Number.isFinite(num) || num < 0) {
      throw new BluewaveError(AIR_COMBAT_BOMBING_PARAMETERS_INVALID, {
        code: AIR_COMBAT_BOMBING_PARAMETERS_INVALID,
        field: check.name,
        value: num,
        reason: `${check.name} must be a non-negative SafeInt`,
      });
    }
  }

  // Validate altitude
  const validAltitudes: BombingAltitude[] = ["HIGH", "MEDIUM", "LOW"];
  if (!validAltitudes.includes(params.altitude)) {
    throw new BluewaveError(AIR_COMBAT_BOMBING_PARAMETERS_INVALID, {
      code: AIR_COMBAT_BOMBING_PARAMETERS_INVALID,
      field: "altitude",
      value: params.altitude,
      reason: `altitude must be one of HIGH, MEDIUM, LOW`,
    });
  }
}
