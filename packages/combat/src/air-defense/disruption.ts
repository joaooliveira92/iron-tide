// D-4 M4 Aviation: Air Defense — AC-12 disruption severity + stacking per DESIGN-45 §6.
// Shipped levels (§6 lines 118-123): LIGHT 9_000/9_500, MODERATE 7_500/8_500,
// SEVERE 5_000/6_500, MISSION_ABORT → attack does not proceed (0/0). Severity ordering:
// LIGHT < MODERATE < SEVERE < MISSION_ABORT.
//
// Stacking rule (§6 line 125): "only the highest severity from one defense layer applies.
// Different defense layers multiply in canonical layer order and round once at final attack
// resolution." `resolveLayerDisruption` reduces the records of ONE layer to its single
// highest-severity representative (first deterministic record on ties — records arrive in
// canonical order); `computeStackedDisruptionMultipliers` then multiplies the per-layer
// accuracy and per-layer cohesion multipliers across layers with ONE floor at the end.
//
// Interpretation (recorded in ADR-0042): stacking produces ONE integer basis-point factor
// per metric, floored ONCE at the stacking boundary; that factor is then consumed by the
// final attack-resolution formula as a single factor in ITS single final floor — there is
// NO second rounding here. The stacking result is validated fail-closed: a floored factor
// outside [0, 10_000] (or a duplicate layer representative) throws AIR_DEFENSE_INVARIANT_FAILED
// rather than being clamped ("Runtime inference and silent fallback behavior are prohibited").
//
// Bound analysis (ENGINEERING-CONTRACT): with at most the four shipped layers, each factor
// <= 10_000 bp, the raw numerator <= 10_000^4 = 10^16 > Number.MAX_SAFE_INTEGER (~9.0e15),
// which proves bigint necessary for the intermediate product; the floored factor is always
// within [0, 10_000] for shipped severities and fits a plain safe integer.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import type { DisruptionRecord, DisruptionSeverityType } from "./air-defense-state.js";
import type { LayerId } from "./air-defense-system-definition.js";
import {
  DISRUPTION_MULTIPLIERS,
  FORMULA_DENOMINATOR,
  OPERATIONAL_MULTIPLIER_BP,
} from "./constants.js";
import { AIR_DEFENSE_INVARIANT_FAILED } from "./reasonCodes.js";

/** Canonical severity ordering (ascending rank). */
const DISRUPTION_SEVERITY_ORDER: readonly DisruptionSeverityType[] = [
  "LIGHT",
  "MODERATE",
  "SEVERE",
  "MISSION_ABORT",
];

/** Rank of a severity in the §6 ordering: LIGHT 0 < MODERATE 1 < SEVERE 2 < MISSION_ABORT 3. */
export function disruptionSeverityRank(severity: DisruptionSeverityType): number {
  const rank = DISRUPTION_SEVERITY_ORDER.indexOf(severity);
  if (rank === -1) {
    throw new BluewaveError("disruptionSeverityRank: unknown disruption severity", { severity });
  }
  return rank;
}

/** Accuracy/cohesion multiplier pair (basis points) for a §6 disruption severity. */
export interface DisruptionSeverityMultiplier {
  accuracyBp: SafeInt;
  cohesionBp: SafeInt;
}

/** Exact §6 multiplier pair for a severity. MISSION_ABORT → 0/0 (attack does not proceed). */
export function disruptionSeverityMultiplier(
  severity: DisruptionSeverityType,
): DisruptionSeverityMultiplier {
  const entry = DISRUPTION_MULTIPLIERS[severity];
  if (entry === undefined) {
    throw new BluewaveError("disruptionSeverityMultiplier: unknown disruption severity", {
      severity,
    });
  }
  return {
    accuracyBp: SafeInt(entry.accuracyBp),
    cohesionBp: SafeInt(entry.cohesionBp),
  };
}

/**
 * Reduces the disruption records of ONE defense layer to the single highest-severity
 * representative (§6 line 125: "only the highest severity from one defense layer applies").
 * Ties keep the first deterministic record (records arrive in canonical order). Returns
 * null when the layer produced no disruption records.
 */
export function resolveLayerDisruption(
  records: readonly DisruptionRecord[],
): DisruptionRecord | null {
  const first = records[0];
  if (first === undefined) return null;
  let best: DisruptionRecord = first;
  for (const record of records) {
    if (disruptionSeverityRank(record.severity) > disruptionSeverityRank(best.severity)) {
      best = record;
    }
  }
  return best;
}

/**
 * Stacks per-layer disruption multipliers across defense layers (§6 line 125): one record
 * per layer (see resolveLayerDisruption). The per-layer accuracy multipliers are multiplied
 * together, and the per-layer cohesion multipliers together, with ONE floor at the end
 * (denominator 10_000^(k-1) for k layers — the exact rational bp product). The floored
 * factor is the SINGLE basis-point factor consumed by the final attack-resolution formula
 * (one factor in ITS single final floor — no second rounding here, ADR-0042).
 *
 * Fail-closed guards:
 * - A duplicate `layer` representative is rejected (AIR_DEFENSE_INVARIANT_FAILED) —
 *   "only the highest severity from one defense layer applies" (§6 line 125), so one layer
 *   may contribute at most one representative.
 * - A floored accuracy or cohesion factor outside [0, 10_000] is rejected
 *   (AIR_DEFENSE_INVARIANT_FAILED) rather than clamped — a multiplier outside the basis-point
 *   range is an invariant violation.
 *
 * A MISSION_ABORT layer → 0/0 (attack does not proceed — the caller must treat 0 as
 * mission-abort). No records → the neutral 10_000/10_000 (no disruption). Multipliers are
 * applied in the order the layer representatives are given (callers supply canonical §1
 * layer order).
 */
export function computeStackedDisruptionMultipliers(layerReps: readonly DisruptionRecord[]): {
  accuracyBp: SafeInt;
  cohesionBp: SafeInt;
} {
  if (layerReps.length === 0) {
    return {
      accuracyBp: SafeInt(OPERATIONAL_MULTIPLIER_BP),
      cohesionBp: SafeInt(OPERATIONAL_MULTIPLIER_BP),
    };
  }

  // Fail-closed: only the highest severity from ONE defense layer applies (§6 line 125) —
  // one representative per layer, never two.
  const seenLayers = new Set<LayerId>();
  for (const rep of layerReps) {
    if (seenLayers.has(rep.layer)) {
      throw new BluewaveError(
        "computeStackedDisruptionMultipliers: duplicate layer representative — only the highest severity from one defense layer applies",
        {
          code: AIR_DEFENSE_INVARIANT_FAILED,
          layer: rep.layer,
        },
      );
    }
    seenLayers.add(rep.layer);
  }

  for (const rep of layerReps) {
    if (rep.severity === "MISSION_ABORT") {
      return { accuracyBp: SafeInt.ZERO, cohesionBp: SafeInt.ZERO };
    }
  }

  let accuracyNumerator = 1n;
  let cohesionNumerator = 1n;
  for (const rep of layerReps) {
    const multiplier = disruptionSeverityMultiplier(rep.severity);
    accuracyNumerator *= BigInt(multiplier.accuracyBp);
    cohesionNumerator *= BigInt(multiplier.cohesionBp);
  }
  // Exact denominator 10_000^(k-1) for k contributing layers (bigint; 10^12 at k=4).
  const denominator: bigint = BigInt(FORMULA_DENOMINATOR) ** BigInt(layerReps.length - 1);

  const rawAccuracy = Number(accuracyNumerator / denominator);
  const rawCohesion = Number(cohesionNumerator / denominator);
  // Fail-closed bound guard (replaces the former clamp): a stacked multiplier outside the
  // basis-point range [0, 10_000] is an invariant violation, never silently clamped.
  if (
    rawAccuracy < 0 ||
    rawAccuracy > OPERATIONAL_MULTIPLIER_BP ||
    rawCohesion < 0 ||
    rawCohesion > OPERATIONAL_MULTIPLIER_BP
  ) {
    throw new BluewaveError(
      "computeStackedDisruptionMultipliers: stacked multiplier outside [0, 10_000]",
      {
        code: AIR_DEFENSE_INVARIANT_FAILED,
        rawAccuracy,
        rawCohesion,
      },
    );
  }
  return {
    accuracyBp: SafeInt(rawAccuracy),
    cohesionBp: SafeInt(rawCohesion),
  };
}
