import { BluewaveError, SafeInt } from "@bluewave/contracts";
import type { DisruptionRecord, DisruptionSeverityType } from "./air-defense-state.js";
import type { LayerId } from "./air-defense-system-definition.js";
import {
  DISRUPTION_MULTIPLIERS,
  FORMULA_DENOMINATOR,
  OPERATIONAL_MULTIPLIER_BP,
} from "./constants.js";
import { AIR_DEFENSE_INVARIANT_FAILED } from "./reasonCodes.js";

const DISRUPTION_SEVERITY_ORDER: readonly DisruptionSeverityType[] = [
  "LIGHT",
  "MODERATE",
  "SEVERE",
  "MISSION_ABORT",
];

export function disruptionSeverityRank(severity: DisruptionSeverityType): number {
  const rank = DISRUPTION_SEVERITY_ORDER.indexOf(severity);
  if (rank === -1) {
    throw new BluewaveError("disruptionSeverityRank: unknown disruption severity", { severity });
  }
  return rank;
}

export interface DisruptionSeverityMultiplier {
  accuracyBp: SafeInt;
  cohesionBp: SafeInt;
}

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
  const denominator: bigint = BigInt(FORMULA_DENOMINATOR) ** BigInt(layerReps.length - 1);

  const rawAccuracy = Number(accuracyNumerator / denominator);
  const rawCohesion = Number(cohesionNumerator / denominator);
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
