import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const SUBMARINE_RELIABILITY_MIN = 0 as const;
export const SUBMARINE_RELIABILITY_MAX = 100 as const;

export const SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP: ReadonlyArray<{
  min: number;
  max: number;
  multiplierBp: number;
}> = [
  { min: 0, max: 19, multiplierBp: 4_000 },
  { min: 20, max: 39, multiplierBp: 6_000 },
  { min: 40, max: 59, multiplierBp: 8_000 },
  { min: 60, max: 79, multiplierBp: 10_000 },
  { min: 80, max: 94, multiplierBp: 11_000 },
  { min: 95, max: 100, multiplierBp: 12_000 },
];

export const SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR = 20 as const;

export const SUBMARINE_OPERATION_CLASSES = [
  "OFFENSIVE_DEPLOYMENT",
  "REPAIR_TRANSFER",
  "TRAINING",
  "EMERGENCY_DEFENSE",
] as const;
export type SubmarineOperationClass = (typeof SUBMARINE_OPERATION_CLASSES)[number];

export const SUBMARINE_RELIABILITY_LOW_OPERATIONS: Readonly<SubmarineOperationClass[]> = [
  "REPAIR_TRANSFER",
  "TRAINING",
  "EMERGENCY_DEFENSE",
];

export function reliabilityOperationalMultiplierBp(reliability: SafeInt): SafeInt {
  if (
    typeof reliability !== "number" ||
    !Number.isInteger(reliability) ||
    reliability < SUBMARINE_RELIABILITY_MIN ||
    reliability > SUBMARINE_RELIABILITY_MAX
  ) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: `reliability must be an integer in [${SUBMARINE_RELIABILITY_MIN}, ${SUBMARINE_RELIABILITY_MAX}] (§7)`,
      value: reliability,
    });
  }
  for (const band of SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP) {
    if (reliability >= band.min && reliability <= band.max) {
      return SafeInt(band.multiplierBp);
    }
  }
  throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
    code: SUBMARINE_STATE_INVARIANT_FAILED,
    reason: "reliability fell outside every §7 multiplier band",
    value: reliability,
  });
}

export type SubmarineReliabilityVerdict =
  | {
      offensiveDeploymentPermitted: true;
      reliability: SafeInt;
      reasonCode: null;
    }
  | {
      offensiveDeploymentPermitted: false;
      reliability: SafeInt;
      reasonCode: typeof SUBMARINE_RELIABILITY_INSUFFICIENT;
      permittedOperationsOnly: Readonly<SubmarineOperationClass[]>;
      message: string;
    };

export function reliabilityOffensiveDeploymentVerdict(
  reliability: SafeInt,
): SubmarineReliabilityVerdict {
  if (reliability >= SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR) {
    return { offensiveDeploymentPermitted: true, reliability, reasonCode: null };
  }
  return {
    offensiveDeploymentPermitted: false,
    reliability,
    reasonCode: SUBMARINE_RELIABILITY_INSUFFICIENT,
    permittedOperationsOnly: SUBMARINE_RELIABILITY_LOW_OPERATIONS,
    message:
      "reliability below 20 prohibits offensive deployment; only repair transfer, training, or emergency defense is permitted",
  };
}
