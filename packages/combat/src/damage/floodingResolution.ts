// DESIGN-41 §§14-18 — Per-minute flooding resolution.
//
// Pure/deterministic: no ambient I/O/clock/random.  Uses a keyed RNG function for
// high-speed loss checks; if keyedRng is null, no stochastic checks are performed.
// Integer fixed-point arithmetic only.

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

/**
 * Convert accumulated flooded-water MASS (integer kilograms — the
 * `progressiveFloodingTotal` accumulation unit) into basis points of the ship's
 * DESIGN DISPLACEMENT:
 *
 *   bp = floor(floodedWaterKg × 10_000 / designDisplacementKg)
 *
 * This is the ONLY lawful place the severity thresholds (500 / 1_500 / 3_000 —
 * basis points, DESIGN-41 §14 / §48 validation 12) get a comparable value: both
 * severity-evaluation call sites (`getFloodingSeverity` for §27-28 allocation
 * priority, and the §17 high-speed-loss eligibility check below) read bp
 * produced here, never the raw accumulated mass (ADR-0047 decision 4 — feeding
 * integer kilograms straight into a bp threshold reads CRITICAL on any real
 * hull almost immediately).
 *
 * Fail closed (DESIGN-41 §1): a non-positive design displacement expresses no
 * basis-point proportion, and a negative/non-finite mass violates the
 * ShipDamageState invariant — both reject with INVALID_SHIP_DAMAGE_STATE
 * rather than silently returning a value that classifies as MINOR (0) or
 * CRITICAL (Infinity).
 */
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

/**
 * Get flooding severity from flooded-water mass proportion (bp of displacement).
 *
 * The input MUST already be basis points of design displacement — convert a
 * kilogram mass with `floodedWaterBpFromKg` first (ADR-0047 decision 4).
 *
 * Thresholds (DESIGN-41 §14):
 *   0..499   → MINOR
 *   500..1_499 → SERIOUS
 *   1_500..2_999 → MAJOR
 *   >= 3_000  → CRITICAL
 */
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

// ---- Speed multiplier per severity (DESIGN-41 §15) ----

/**
 * Get the maximum-speed multiplier (bp) for a given severity.
 */
export function getFloodingSpeedMultiplierBp(severity: FloodingSeverity): number {
  return FLOODING_SPEED_MULTIPLIERS[severity]!;
}

/**
 * Get the stability multiplier (bp) for a given severity.
 */
export function getFloodingStabilityMultiplierBp(severity: FloodingSeverity): number {
  return FLOODING_STABILITY_MULTIPLIERS[severity]!;
}

// ---- Speed-pressure multiplier (DESIGN-41 §16) ----

/**
 * Get the speed-pressure multiplier (bp) for a given speed in knots.
 *
 * Bands:
 *   ≤10   → 7_500 bp
 *   ≤15   → 10_000 bp
 *   ≤20   → 12_500 bp
 *   ≤25   → 15_000 bp
 *   >25   → 20_000 bp
 *
 * Speed exactly 10 knots gets the ≤10 band (7_500 bp).
 */
export function getSpeedPressureMultiplierBp(speedKt: number): number {
  for (const band of SPEED_PRESSURE_MULTIPLIERS) {
    if (speedKt <= band.maxSpeedKt) {
      return band.multiplierBp;
    }
  }
  // Fallback (last band has Infinity so this should never be reached)
  return SPEED_PRESSURE_MULTIPLIERS[SPEED_PRESSURE_MULTIPLIERS.length - 1]!.multiplierBp;
}

// ---- Net flooding delta (DESIGN-41 §18) ----

/**
 * Compute net flooding delta per tactical minute (DESIGN-41 §18).
 *
 * Formula:
 *   rawIngress = floor(totalIngressKgMin * speedPressureBp * progressiveFailureBp / 10_000^2)
 *   netDeltaKgMin = max(0, rawIngress - effectivePumping - effectiveRepairReduction)
 *
 * When pumping > ingress (rawIngress - effectivePumping - effectiveRepairReduction < 0),
 * dewatering occurs at DEWATERING_RATE_KG_MIN.
 *
 * @param totalIngressKgMin - Sum of all active flooding source rates (kg/min).
 * @param speedKt - Current ship speed in knots.
 * @param progressiveFailureBp - Progressive failure multiplier (bp).
 * @param effectivePumping - Effective pumping capacity (kg/min).
 * @param effectiveRepairReduction - Effective repair reduction (kg/min).
 * @returns Object with netDeltaKgMin (always ≥ 0) and dewateringKgMin (≥ 0 when dewatering).
 */
export function computeNetFloodingDelta(
  totalIngressKgMin: number,
  speedKt: number,
  progressiveFailureBp: number,
  effectivePumping: number,
  effectiveRepairReduction: number,
): { netDeltaKgMin: number; dewateringKgMin: number } {
  const speedPressureBp = getSpeedPressureMultiplierBp(speedKt);

  // rawIngress = floor(totalIngress * speedPressureBp * progressiveFailureBp / 10_000^2)
  const numerator = totalIngressKgMin * speedPressureBp * progressiveFailureBp;
  const divisor = 10_000 * 10_000; // 100_000_000
  const rawIngress = Math.floor(numerator / divisor);

  const totalReduction = effectivePumping + effectiveRepairReduction;
  const netDeltaKgMin = Math.max(0, rawIngress - totalReduction);

  // Dewatering occurs when pumping/repair exceeds raw ingress
  const dewateringKgMin =
    rawIngress - totalReduction < 0 && effectivePumping > 0 ? DEWATERING_RATE_KG_MIN : 0;

  return { netDeltaKgMin, dewateringKgMin };
}

// ---- High-speed loss check (DESIGN-41 §17) ----

/**
 * Check for high-speed flooding loss risk (DESIGN-41 §17).
 *
 * Only meaningful when severity is MAJOR or CRITICAL and speed > 20 knots.
 * Uses RNG stream "battle/ship/flooding/high_speed_loss".
 *
 * @param severity - Current flooding severity.
 * @param speedKt - Current ship speed in knots.
 * @param keyedRng - Deterministic RNG function keyed by stream name, returns float [0, 1).
 *                   If null, no stochastic check is performed (returns false).
 * @returns true if a high-speed loss event occurs.
 */
export function checkHighSpeedLoss(
  severity: FloodingSeverity,
  speedKt: number,
  keyedRng: ((stream: string) => number) | null,
): boolean {
  // No RNG available → deterministic mode, no loss
  if (keyedRng === null) {
    return false;
  }

  // Only MAJOR and CRITICAL severities are at risk
  if (severity !== "MAJOR" && severity !== "CRITICAL") {
    return false;
  }

  // Only speeds over 20 knots trigger high-speed loss checks
  if (speedKt <= 20) {
    return false;
  }

  // Determine speed band
  const speedBand = speedKt <= 25 ? "20-25" : "OVER_25";

  // Look up probability in bp
  const probabilityBp = HIGH_SPEED_LOSS_PROBABILITY[severity]?.[speedBand] ?? 0;

  // RNG draw compared to probability
  const draw = keyedRng("battle/ship/flooding/high_speed_loss");
  const drawBp = Math.floor(draw * 10_000);

  return drawBp < probabilityBp;
}

// ---- Resolve one minute of flooding progression ----

/**
 * Resolve one minute of flooding progression (DESIGN-41 §18).
 *
 * For the total ingress from all flooding sources:
 * 1. Compute net flooding delta
 * 2. Determine severity from total flooded water
 * 3. Check for high-speed loss if applicable
 *
 * Unit contract (ADR-0047 decision 4): the accumulated flooding surface is
 * integer KILOGRAMS (`currentFloodedWaterKg` + the kg/min delta) and stays in
 * kg — conversion to basis points of design displacement happens only for
 * severity evaluation (`getFloodingSeverity`), which is also what gates the §17
 * high-speed-loss check, so both consumers read the same bp unit.
 *
 * @param floodingRecords - Current active flooding source records.
 * @param currentFloodedWaterKg - Current accumulated flooded water mass (kg).
 * @param designDisplacementKg - The ship's design displacement (kg) — the bp denominator.
 * @param speedKt - Current ship speed in knots.
 * @param progressiveFailureBp - Progressive failure multiplier (bp).
 * @param effectivePumping - Effective pumping capacity (kg/min).
 * @param effectiveRepairReduction - Effective repair reduction (kg/min).
 * @param keyedRng - Deterministic RNG function, or null for deterministic mode.
 * @returns Updated flooding state and resolution results.
 */
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
  /** Accumulated flooded water MASS in kg (field name is the pre-existing
   *  surface; ADR-0047 decision 4 keeps the accumulation in kg). */
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

  // Step 3: Update accumulated flooding MASS (kg — never rewritten to bp; the
  // caller stores this straight back onto progressiveFloodingTotal).
  const nextFloodedWaterBp = currentFloodedWaterKg + netDeltaKgMin;

  // Step 4: Determine severity — convert kg -> bp of design displacement
  // (DESIGN-41 §14/§48 v12; ADR-0047 decision 4). This is the POST-delta site:
  // the conversion runs on the accumulated mass AFTER this minute's net delta,
  // and feeds §18 severity plus the §17 high-speed-loss eligibility below. The
  // other site is damageControlEngineWiring.resolveDamageControl, which converts
  // the PRE-delta mass (the mass at the START of the minute) for §27-28
  // allocation priority. Both go through the shared floodedWaterBpFromKg helper.
  const severity = getFloodingSeverity(
    floodedWaterBpFromKg(nextFloodedWaterBp, designDisplacementKg),
  );

  // Step 5: Check for high-speed loss (§17 eligibility consumes the SAME bp-derived severity)
  const highSpeedLoss = checkHighSpeedLoss(severity, speedKt, keyedRng);

  return {
    floodingRecords, // Records are unchanged in this stage
    nextFloodedWaterBp,
    severity,
    highSpeedLoss,
    netDeltaKgMin,
  };
}
