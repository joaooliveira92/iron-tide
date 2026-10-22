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

  if (Number(distanceM) === 0) {
    return SafeInt.ZERO;
  }

  const speedPerMinute = SafeInt.mul(speedMps, SafeInt(60));

  const denominator = Number(speedPerMinute) < 1 ? SafeInt.ONE : speedPerMinute;

  return SafeInt.div(distanceM, denominator, "ceil");
}

export interface BombingAccuracyParams {
  baseAccuracyBp: SafeInt;
  payloadCapacity: SafeInt;
  visibilityBp: SafeInt;
  targetManeuverBp: SafeInt;
  disruptionBp: SafeInt;
  altitude: BombingAltitude;
}

export function computeBombingAccuracy(params: BombingAccuracyParams): SafeInt {
  validateBombingParams(params);

  const altitudePenaltyBp = getAltitudePenaltyBp(params.altitude);

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

  const numerator =
    BigInt(Number(params.baseAccuracyBp)) *
    BigInt(Number(altitudePenaltyBp)) *
    BigInt(Number(params.visibilityBp)) *
    BigInt(Number(params.targetManeuverBp)) *
    BigInt(Number(params.disruptionBp)) *
    BigInt(Number(payloadFactorBp));

  const denominator = BigInt(AIR_COMBAT_BASIS_POINTS) ** 5n;

  const accuracyBp = Number(numerator / denominator);

  return SafeInt(Math.max(0, Math.min(AIR_COMBAT_BASIS_POINTS, accuracyBp)));
}

export function computeBombDamageMultiplier(isDiveBomb: boolean): SafeInt {
  if (isDiveBomb) {
    return SafeInt(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
  }
  return SafeInt(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
}

export function computePenetrationMultiplier(isDiveBomb: boolean): SafeInt {
  if (isDiveBomb) {
    return SafeInt(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
  }
  return SafeInt(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
}

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
