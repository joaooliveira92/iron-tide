// D-3 M4 Aviation: CAP & Strikes — INC-2 (AC-5): air-to-air exchange formula.
// 6-factor squadron-quality exchange with integer bp arithmetic, floor-once,
// bigint intermediate, keyed RNG draw.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { type RandomEngine, drawUniform } from "@bluewave/random";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_QUALITY_MIN_BP,
  AIR_COMBAT_QUALITY_MAX_BP,
  AIR_COMBAT_NUMERICAL_MIN_BP,
  AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
  AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
  AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
  AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
  AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
} from "./constants.js";
import {
  AIR_COMBAT_QUALITY_OUT_OF_RANGE,
  AIR_COMBAT_ATTACKER_ZERO_STRENGTH,
  AIR_COMBAT_NO_AVAILABLE_TARGET,
} from "./reasonCodes.js";

export interface ExchangeInput {
  attackerCombatIndex: SafeInt; // 0-100
  defenderCombatIndex: SafeInt; // 0-100
  attackerCount: SafeInt;
  defenderCount: SafeInt;
  attackerAltitude: "HIGH" | "MEDIUM" | "LOW";
  defenderAltitude: "HIGH" | "MEDIUM" | "LOW";
  isFirstPass: boolean; // surprise modifier
  defenderToughness: SafeInt; // 0-100
  escortModifierBp: SafeInt; // 10_000 = full (no escort), lower = escort reduces CAP effect
}

export interface ExchangeResult {
  killProbabilityBp: SafeInt;
  losses: SafeInt;
  damaged: SafeInt;
  factorContributions: Record<string, SafeInt>;
  rngDraw: SafeInt;
}

const ALTITUDE_ORDER: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Compute the quality factor in basis points.
 * qualityBp = clamp(0, 10_000, attackerCombatIndex * 10_000 / max(1, defenderCombatIndex))
 */
function computeQualityBp(attackerCombatIndex: SafeInt, defenderCombatIndex: SafeInt): SafeInt {
  const denom = Number(defenderCombatIndex) < 1 ? SafeInt.ONE : defenderCombatIndex;
  const raw = SafeInt.div(
    SafeInt.mul(attackerCombatIndex, SafeInt(AIR_COMBAT_BASIS_POINTS)),
    denom,
    "floor",
  );
  const clamped = Math.min(
    AIR_COMBAT_QUALITY_MAX_BP,
    Math.max(AIR_COMBAT_QUALITY_MIN_BP, Number(raw)),
  );
  return SafeInt(clamped);
}

/**
 * Compute the numerical advantage factor in basis points.
 * numericalAdvantageBp = clamp(500, 10_000, attackerCount * 10_000 / max(1, defenderCount))
 */
function computeNumericalAdvantageBp(attackerCount: SafeInt, defenderCount: SafeInt): SafeInt {
  const denom = Number(defenderCount) < 1 ? SafeInt.ONE : defenderCount;
  const raw = SafeInt.div(
    SafeInt.mul(attackerCount, SafeInt(AIR_COMBAT_BASIS_POINTS)),
    denom,
    "floor",
  );
  const clamped = Math.min(
    AIR_COMBAT_BASIS_POINTS,
    Math.max(AIR_COMBAT_NUMERICAL_MIN_BP, Number(raw)),
  );
  return SafeInt(clamped);
}

/**
 * Compute the altitude factor in basis points based on relative altitude.
 * Attacker above defender → 12_500
 * Same altitude → 10_000
 * Attacker below defender → 8_500
 */
function computeAltitudeBp(
  attackerAltitude: "HIGH" | "MEDIUM" | "LOW",
  defenderAltitude: "HIGH" | "MEDIUM" | "LOW",
): SafeInt {
  const attackerLevel = ALTITUDE_ORDER[attackerAltitude] ?? 0;
  const defenderLevel = ALTITUDE_ORDER[defenderAltitude] ?? 0;

  if (attackerLevel > defenderLevel) {
    return SafeInt(AIR_COMBAT_ALTITUDE_ADVANTAGE_BP);
  }
  if (attackerLevel === defenderLevel) {
    return SafeInt(AIR_COMBAT_ALTITUDE_NEUTRAL_BP);
  }
  return SafeInt(AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP);
}

/**
 * Compute the surprise factor in basis points.
 * First pass → 12_500, subsequent → 10_000
 */
function computeSurpriseBp(isFirstPass: boolean): SafeInt {
  return isFirstPass
    ? SafeInt(AIR_COMBAT_SURPRISE_FIRST_PASS_BP)
    : SafeInt(AIR_COMBAT_SURPRISE_SUBSEQUENT_BP);
}

/**
 * Compute the defender survival factor in basis points.
 * survivalBp = 9_000 + floor(toughness * 1_000 / 100), clamped to [9_000, 10_000]
 */
function computeDefenderSurvivalBp(toughness: SafeInt): SafeInt {
  const bonus = SafeInt.div(SafeInt.mul(toughness, SafeInt(1_000)), SafeInt(100), "floor");
  const raw = SafeInt.add(SafeInt(9_000), bonus);
  const clamped = Math.min(AIR_COMBAT_BASIS_POINTS, Math.max(9_000, Number(raw)));
  return SafeInt(clamped);
}

/**
 * Executes the 6-factor air-to-air exchange formula.
 *
 * 1. Validates inputs (combat index ranges, non-zero counts).
 * 2. Computes 6 factors (quality, numericalAdvantage, altitude, surprise,
 *    defenderSurvival, escort).
 * 3. Computes kill probability via bigint: floor(baseBp * Π factorBp / 10_000^6).
 * 4. Computes losses = floor(killProbBp * defenderCount / 10_000).
 * 5. Computes damaged = floor(losses * destroyedDamageRatio / 10_000).
 * 6. Draws one keyed RNG value; if draw < killProbBp, losses/damaged apply.
 *
 * @param input - Exchange input parameters.
 * @param rngEngine - RandomEngine for keyed draw (domain: "air-combat/exchange").
 * @returns ExchangeResult with kill probability, losses, and factor contributions.
 * @throws BluewaveError on invalid input.
 */
export function computeExchange(input: ExchangeInput, rngEngine: RandomEngine): ExchangeResult {
  const attackerCI = Number(input.attackerCombatIndex);
  const defenderCI = Number(input.defenderCombatIndex);
  const attackerCount = Number(input.attackerCount);
  const defenderCount = Number(input.defenderCount);

  if (attackerCI < 0 || attackerCI > 100) {
    throw new BluewaveError(AIR_COMBAT_QUALITY_OUT_OF_RANGE, {
      code: AIR_COMBAT_QUALITY_OUT_OF_RANGE,
      field: "attackerCombatIndex",
      value: attackerCI,
      reason: "attackerCombatIndex must be in range [0, 100]",
    });
  }
  if (defenderCI < 0 || defenderCI > 100) {
    throw new BluewaveError(AIR_COMBAT_QUALITY_OUT_OF_RANGE, {
      code: AIR_COMBAT_QUALITY_OUT_OF_RANGE,
      field: "defenderCombatIndex",
      value: defenderCI,
      reason: "defenderCombatIndex must be in range [0, 100]",
    });
  }
  if (attackerCount <= 0) {
    throw new BluewaveError(AIR_COMBAT_ATTACKER_ZERO_STRENGTH, {
      code: AIR_COMBAT_ATTACKER_ZERO_STRENGTH,
      field: "attackerCount",
      value: attackerCount,
      reason: "attacker must have at least 1 aircraft",
    });
  }
  if (defenderCount <= 0) {
    throw new BluewaveError(AIR_COMBAT_NO_AVAILABLE_TARGET, {
      code: AIR_COMBAT_NO_AVAILABLE_TARGET,
      field: "defenderCount",
      value: defenderCount,
      reason: "defender must have at least 1 aircraft",
    });
  }

  // ---- Compute 6 factors ----

  const qualityBp = computeQualityBp(input.attackerCombatIndex, input.defenderCombatIndex);
  const numericalAdvantageBp = computeNumericalAdvantageBp(
    input.attackerCount,
    input.defenderCount,
  );
  const altitudeBp = computeAltitudeBp(input.attackerAltitude, input.defenderAltitude);
  const surpriseBp = computeSurpriseBp(input.isFirstPass);
  const defenderSurvivalBp = computeDefenderSurvivalBp(input.defenderToughness);
  const escortBp = input.escortModifierBp;

  const factorContributions: Record<string, SafeInt> = {
    quality: qualityBp,
    numericalAdvantage: numericalAdvantageBp,
    altitude: altitudeBp,
    surprise: surpriseBp,
    defenderSurvival: defenderSurvivalBp,
    escort: escortBp,
  };

  // ---- Kill probability (bigint arithmetic) ----
  // numerator = 10_000 * quality * numericalAdvantage * altitude * surprise * defenderSurvival * escort
  // denominator = 10_000^6
  const denominator = BigInt(AIR_COMBAT_BASIS_POINTS) ** 6n;

  let numerator: bigint = BigInt(AIR_COMBAT_BASIS_POINTS);
  numerator *= BigInt(Number(qualityBp));
  numerator *= BigInt(Number(numericalAdvantageBp));
  numerator *= BigInt(Number(altitudeBp));
  numerator *= BigInt(Number(surpriseBp));
  numerator *= BigInt(Number(defenderSurvivalBp));
  numerator *= BigInt(Number(escortBp));

  const rawKillProbability = Number(numerator / denominator);
  const killProbabilityBp = SafeInt(
    Math.min(AIR_COMBAT_BASIS_POINTS, Math.max(0, rawKillProbability)),
  );

  const killProbNum = Number(killProbabilityBp);
  const rawLosses = Math.floor((killProbNum * defenderCount) / AIR_COMBAT_BASIS_POINTS);
  // Minimum 1 loss if kill probability > 0, cap at defenderCount
  const cappedLosses = Math.min(defenderCount, killProbNum > 0 ? Math.max(1, rawLosses) : 0);
  const losses = SafeInt(cappedLosses);

  const rawDamaged = Math.floor(
    (cappedLosses * AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP) / AIR_COMBAT_BASIS_POINTS,
  );
  const damaged = SafeInt(rawDamaged);

  const stream = rngEngine.stream("air-combat/exchange");
  const rngDraw = drawUniform(stream, SafeInt(0), SafeInt(AIR_COMBAT_BASIS_POINTS - 1));

  const isSuccessful = Number(rngDraw) < Number(killProbabilityBp);

  return {
    killProbabilityBp,
    losses: isSuccessful ? losses : SafeInt.ZERO,
    damaged: isSuccessful ? damaged : SafeInt.ZERO,
    factorContributions,
    rngDraw,
  };
}

/**
 * Computes a single combat index from aircraft performance scores.
 * combatIndex = floor((speed + firepower + maneuverability) / 3)
 * Must return 0-100 range.
 *
 * @param speed - Aircraft speed score (SafeInt, 0-100).
 * @param firepower - Aircraft firepower score (SafeInt, 0-100).
 * @param maneuverability - Aircraft maneuverability score (SafeInt, 0-100).
 * @returns Combat index (SafeInt, 0-100).
 */
export function computeCombatIndex(
  speed: SafeInt,
  firepower: SafeInt,
  maneuverability: SafeInt,
): SafeInt {
  const sum = SafeInt.add(SafeInt.add(speed, firepower), maneuverability);
  const index = SafeInt.div(sum, SafeInt(3), "floor");
  // Clamp to [0, 100]
  return SafeInt(Math.min(100, Math.max(0, Number(index))));
}

/**
 * Computes the defender survival factor in basis points.
 * survivalBp = 9_000 + floor(toughness * 1_000 / 100), clamped to [9_000, 10_000]
 *
 * @param toughness - Defender toughness score (SafeInt, 0-100).
 * @returns Survival factor in basis points (SafeInt, 9_000-10_000).
 */
export function computeDefenderSurvivalFactorBp(toughness: SafeInt): SafeInt {
  return computeDefenderSurvivalBp(toughness);
}
