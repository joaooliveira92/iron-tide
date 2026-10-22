import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { type SubmarineSeaStateCategory } from "./constants.js";
import {
  SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const SUBMARINE_SEA_STATE_MIN = 0 as const;
export const SUBMARINE_SEA_STATE_MAX = 9 as const;

export const SUBMARINE_SEA_STATE_OPTIMUM_MIN = 2 as const;
export const SUBMARINE_SEA_STATE_OPTIMUM_MAX = 5 as const;

export function seaStateCategory(seaState: SafeInt): SubmarineSeaStateCategory {
  if (
    !SafeInt.isSafeInt(seaState) ||
    seaState < SUBMARINE_SEA_STATE_MIN ||
    seaState > SUBMARINE_SEA_STATE_MAX
  ) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: `sea state must be an integer in [${SUBMARINE_SEA_STATE_MIN}, ${SUBMARINE_SEA_STATE_MAX}] (§13)`,
      value: seaState,
    });
  }
  if (seaState <= 1) return "CALM";
  if (seaState <= 5) return "OPTIMAL";
  if (seaState <= 7) return "HEAVY";
  return "SEVERE";
}

export function isOptimumSeaState(seaState: SafeInt): boolean {
  return seaState >= SUBMARINE_SEA_STATE_OPTIMUM_MIN && seaState <= SUBMARINE_SEA_STATE_OPTIMUM_MAX;
}

const SUBMARINE_DETECTION_MULTIPLIER_TABLE_BP: Readonly<Record<number, number>> = {
  0: 13_000,
  1: 11_500,
  2: 10_000,
  3: 9_500,
  4: 9_500,
  5: 10_000,
  6: 10_500,
  7: 11_000,
  8: 11_500,
  9: 12_500,
};

export function submarineDetectionMultiplierBp(seaState: SafeInt): SafeInt {
  const value = SUBMARINE_DETECTION_MULTIPLIER_TABLE_BP[seaState];
  if (typeof value !== "number") {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: `§14 detection multiplier missing for sea state ${seaState}`,
      value: seaState,
    });
  }
  return SafeInt(value);
}

export const SUBMARINE_SURFACED_DETECTION_ADDITION_BP = 12_500 as const;

export function submarineSurfacedDetectionBp(seaState: SafeInt): SafeInt {
  const base = submarineDetectionMultiplierBp(seaState);
  if (seaState <= 1) {
    return SafeInt(base + SUBMARINE_SURFACED_DETECTION_ADDITION_BP);
  }
  return base;
}

const SUBMARINE_OBSERVATION_MULTIPLIER_TABLE_BP: Readonly<Record<number, number>> = {
  0: 11_000,
  1: 10_500,
  2: 10_000,
  3: 10_000,
  4: 10_000,
  5: 9_500,
  6: 8_000,
  7: 6_500,
  8: 5_000,
  9: 3_500,
};

export function submarineObservationMultiplierBp(seaState: SafeInt): SafeInt {
  const value = SUBMARINE_OBSERVATION_MULTIPLIER_TABLE_BP[seaState];
  if (typeof value !== "number") {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: `§15 observation multiplier missing for sea state ${seaState}`,
      value: seaState,
    });
  }
  return SafeInt(value);
}

const SUBMARINE_ATTACK_MULTIPLIER_TABLE_BP: Readonly<Record<number, number>> = {
  0: 10_000,
  1: 10_000,
  2: 10_500,
  3: 11_000,
  4: 11_000,
  5: 10_500,
  6: 8_500,
  7: 7_000,
  8: 5_000,
  9: 2_500,
};

export function submarineAttackMultiplierBp(seaState: SafeInt): SafeInt {
  const value = SUBMARINE_ATTACK_MULTIPLIER_TABLE_BP[seaState];
  if (typeof value !== "number") {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: `§16 attack multiplier missing for sea state ${seaState}`,
      value: seaState,
    });
  }
  return SafeInt(value);
}

export const SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP = 7_500 as const;
export const SUBMARINE_SURFACED_TRANSIT_SPEED_BP = 7_500 as const;

export function isSeaStateOperationProhibited(seaState: SafeInt): boolean {
  if (
    !SafeInt.isSafeInt(seaState) ||
    seaState < SUBMARINE_SEA_STATE_MIN ||
    seaState > SUBMARINE_SEA_STATE_MAX
  ) {
    return true;
  }
  return seaState >= 8;
}

export function assertSeaStateOperationPermitted(seaState: SafeInt): void {
  if (isSeaStateOperationProhibited(seaState)) {
    throw new BluewaveError(SUBMARINE_SEA_STATE_OPERATION_PROHIBITED, {
      code: SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
      reason: `§17: sea state ${seaState} — deck-gun attack and surface battery charging prohibited at sea state 8+`,
      value: seaState,
    });
  }
}

export interface SeaStateProfile {
  seaState: SafeInt;
  category: SubmarineSeaStateCategory;
  isOptimum: boolean;
  detectionMultiplierBp: SafeInt;
  surfacedDetectionBp: SafeInt;
  observationMultiplierBp: SafeInt;
  attackMultiplierBp: SafeInt;
  operationProhibited: boolean;
  snorkelMachineryMultiplierBp: SafeInt;
  surfacedTransitSpeedBp: SafeInt;
}

export function buildSeaStateProfile(seaState: SafeInt): SeaStateProfile {
  return {
    seaState,
    category: seaStateCategory(seaState),
    isOptimum: isOptimumSeaState(seaState),
    detectionMultiplierBp: submarineDetectionMultiplierBp(seaState),
    surfacedDetectionBp: submarineSurfacedDetectionBp(seaState),
    observationMultiplierBp: submarineObservationMultiplierBp(seaState),
    attackMultiplierBp: submarineAttackMultiplierBp(seaState),
    operationProhibited: isSeaStateOperationProhibited(seaState),
    snorkelMachineryMultiplierBp: SafeInt(SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP),
    surfacedTransitSpeedBp: SafeInt(SUBMARINE_SURFACED_TRANSIT_SPEED_BP),
  };
}

export const SHIPPED_SEA_STATE_DETECTION_TABLE_BP: Readonly<Record<number, number>> =
  SUBMARINE_DETECTION_MULTIPLIER_TABLE_BP;
export const SHIPPED_SEA_STATE_OBSERVATION_TABLE_BP: Readonly<Record<number, number>> =
  SUBMARINE_OBSERVATION_MULTIPLIER_TABLE_BP;
export const SHIPPED_SEA_STATE_ATTACK_TABLE_BP: Readonly<Record<number, number>> =
  SUBMARINE_ATTACK_MULTIPLIER_TABLE_BP;
