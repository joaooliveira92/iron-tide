// DESIGN-34 §7 reliability (AC-5, INC-2). Integer range 0..100 and the shipped
// operational multiplier table (0..19:4_000 … 95..100:12_000 basis points).
// A reliability score below 20 prohibits OFFENSIVE deployment and permits only
// repair transfer, training, or emergency defense (§7 exact).
//
// Two distinct concerns, separated on purpose:
//   - `reliabilityOperationalMultiplierBp` : pure §7 table lookup for a valid
//     reliability 0..100. A value outside the §7 integer range is an
//     out-of-contract input and fails closed with SUBMARINE_STATE_INVARIANT_FAILED
//     (the module's ambient fail-closed carrier — a §7 range violation, not an
//     INC-2 owning boundary). The table itself defines 4_000 for the 0..19 band;
//     the OFFENSIVE-DEPLOYMENT prohibition (below 20) is a SEPARATE surface below.
//   - `reliabilityOffensiveDeploymentVerdict` : the §7 "below 20 prohibits
//     offensive deployment" predicate. Below 20 it fails closed with
//     SUBMARINE_RELIABILITY_INSUFFICIENT (INC-2's owning §7 boundary) and reports
//     the only permitted operation classes (repair transfer / training /
//     emergency defense). No operations machinery is built (per ticket — the
//     verdict/predicate surface only).
//
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// DESIGN-34 §7 exact integer range.
export const SUBMARINE_RELIABILITY_MIN = 0 as const;
export const SUBMARINE_RELIABILITY_MAX = 100 as const;

// DESIGN-34 §7 exact operational multiplier table. Bands are contiguous and
// cover the full 0..100 range with no gaps or overlaps.
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

// DESIGN-34 §7 "below 20 prohibits offensive deployment".
export const SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR = 20 as const;

// §7 "permits only repair transfer, training, or emergency defense" — the only
// operation classes available to an asset whose reliability is below the
// offensive-deployment floor. Exposed as the verdict surface; the operations
// themselves (transfer/training/defense mechanics) are NOT built in this slice.
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

// Pure §7 table lookup for a valid reliability 0..100 (branded SafeInt). Returns
// the band's shipped multiplier basis-point value.
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
  // Defensive: the full 0..100 range is covered by the contiguous bands above,
  // so this is unreachable for a validated reliability; still fail closed.
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

// §7 "below 20 prohibits offensive deployment and permits only repair transfer,
// training, or emergency defense." A reliability at or above the floor permits
// offensive deployment; below it fails closed with
// SUBMARINE_RELIABILITY_INSUFFICIENT and reports the only permitted operations.
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
