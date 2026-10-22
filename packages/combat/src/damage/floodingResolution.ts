import { BluewaveError } from "@bluewave/contracts";
import type { FloodingSourceRecord } from "./state.js";
import { INVALID_SHIP_DAMAGE_STATE } from "./reasonCodes.js";
import {
  FLOODING_SEVERITY_THRESHOLDS,
  FLOODING_SPEED_MULTIPLIERS,
  FLOODING_STABILITY_MULTIPLIERS,
  SPEED_PRESSURE_MULTIPLIERS,
  HIGH_SPEED_LOSS_PROBABILITY,
  DEWATERING_RATE_KG_MIN,
} from "./floodingConstants.js";

export type FloodingSeverity = "MINOR" | "SERIOUS" | "MAJOR" | "CRITICAL";

export function floodedWaterBpFromKg(floodedWaterKg: number, designDisplacementKg: number): number {
  if (!Number.isInteger(floodedWaterKg) || floodedWaterKg < 0) {
    throw new BluewaveError(INVALID_SHIP_DAMAGE_STATE, {
      code: INVALID_SHIP_DAMAGE_STATE,
      floodedWaterKg,
      designDisplacementKg,
      reason: "flooded water mass must be a non-negative integer (kg)",
    });
  }
  if (!Number.isFinite(designDisplacementKg) || designDisplacementKg <= 0) {
    throw new BluewaveError(INVALID_SHIP_DAMAGE_STATE, {
      code: INVALID_SHIP_DAMAGE_STATE,
      floodedWaterKg,
      designDisplacementKg,
      reason: "design displacement must be a positive integer (kg) to express bp of displacement",
    });
  }
  return Math.floor((floodedWaterKg * 10_000) / designDisplacementKg);
}

export function getFloodingSeverity(floodedWaterBp: number): FloodingSeverity {
  if (floodedWaterBp <= FLOODING_SEVERITY_THRESHOLDS.MINOR_MAX) {
    return "MINOR";
  }
  if (floodedWaterBp <= FLOODING_SEVERITY_THRESHOLDS.SERIOUS_MAX) {
    return "SERIOUS";
  }
  if (floodedWaterBp <= FLOODING_SEVERITY_THRESHOLDS.MAJOR_MAX) {
    return "MAJOR";
  }
  return "CRITICAL";
}

export function getFloodingSpeedMultiplierBp(severity: FloodingSeverity): number {
  return FLOODING_SPEED_MULTIPLIERS[severity]!;
}

export function getFloodingStabilityMultiplierBp(severity: FloodingSeverity): number {
  return FLOODING_STABILITY_MULTIPLIERS[severity]!;
}

export function getSpeedPressureMultiplierBp(speedKt: number): number {
  for (const band of SPEED_PRESSURE_MULTIPLIERS) {
    if (speedKt <= band.maxSpeedKt) {
      return band.multiplierBp;
    }
  }
  return SPEED_PRESSURE_MULTIPLIERS[SPEED_PRESSURE_MULTIPLIERS.length - 1]!.multiplierBp;
}

export function computeNetFloodingDelta(
  totalIngressKgMin: number,
  speedKt: number,
  progressiveFailureBp: number,
  effectivePumping: number,
  effectiveRepairReduction: number,
): { netDeltaKgMin: number; dewateringKgMin: number } {
  const speedPressureBp = getSpeedPressureMultiplierBp(speedKt);

  const numerator = totalIngressKgMin * speedPressureBp * progressiveFailureBp;
  const divisor = 10_000 * 10_000;
  const rawIngress = Math.floor(numerator / divisor);

  const totalReduction = effectivePumping + effectiveRepairReduction;
  const netDeltaKgMin = Math.max(0, rawIngress - totalReduction);

  const dewateringKgMin =
    rawIngress - totalReduction < 0 && effectivePumping > 0 ? DEWATERING_RATE_KG_MIN : 0;

  return { netDeltaKgMin, dewateringKgMin };
}

export function checkHighSpeedLoss(
  severity: FloodingSeverity,
  speedKt: number,
  keyedRng: ((stream: string) => number) | null,
): boolean {
  if (keyedRng === null) {
    return false;
  }

  if (severity !== "MAJOR" && severity !== "CRITICAL") {
    return false;
  }

  if (speedKt <= 20) {
    return false;
  }

  const speedBand = speedKt <= 25 ? "20-25" : "OVER_25";

  const probabilityBp = HIGH_SPEED_LOSS_PROBABILITY[severity]?.[speedBand] ?? 0;

  const draw = keyedRng("battle/ship/flooding/high_speed_loss");
  const drawBp = Math.floor(draw * 10_000);

  return drawBp < probabilityBp;
}

export function resolveFloodingProgression(
  floodingRecords: FloodingSourceRecord[],
  currentFloodedWaterKg: number,
  designDisplacementKg: number,
  speedKt: number,
  progressiveFailureBp: number,
  effectivePumping: number,
  effectiveRepairReduction: number,
  keyedRng: ((stream: string) => number) | null,
): {
  floodingRecords: FloodingSourceRecord[];
  nextFloodedWaterBp: number;
  severity: FloodingSeverity;
  highSpeedLoss: boolean;
  netDeltaKgMin: number;
} {
  const totalIngressKgMin = floodingRecords.reduce((sum, record) => sum + record.rateKgMin, 0);

  const { netDeltaKgMin } = computeNetFloodingDelta(
    totalIngressKgMin,
    speedKt,
    progressiveFailureBp,
    effectivePumping,
    effectiveRepairReduction,
  );

  const nextFloodedWaterBp = currentFloodedWaterKg + netDeltaKgMin;

  const severity = getFloodingSeverity(
    floodedWaterBpFromKg(nextFloodedWaterBp, designDisplacementKg),
  );

  const highSpeedLoss = checkHighSpeedLoss(severity, speedKt, keyedRng);

  return {
    floodingRecords,
    nextFloodedWaterBp,
    severity,
    highSpeedLoss,
    netDeltaKgMin,
  };
}
