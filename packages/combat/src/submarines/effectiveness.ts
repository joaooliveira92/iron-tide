// DESIGN-34 §11 strategic mission effectiveness (AC-9, INC-4) + §12 coastal range
// restriction (AC-10, INC-4).
//
// §11 formula:
//   effectiveMissionStrength = floor(
//     baseMissionStrength
//     * typeRemoteEfficiencyBp
//     * reliabilityMultiplierBp
//     * baseSupportMultiplierBp
//     * policyMultiplierBp
//     * intelligenceMultiplierBp
//     * enemyProtectionMultiplierBp
//     * blockadeMultiplierBp
//     / 10_000^7
//   )
//
// DESIGN-34 §11 ships the formula structure and requires every multiplier to be
// explicit and versioned. It does NOT ship specific basis-point constants for
// baseSupportMultiplierBp, policyMultiplierBp, intelligenceMultiplierBp,
// enemyProtectionMultiplierBp, or blockadeMultiplierBp — those are AUTHORED
// non-normative defaults (10_000 = 1.0x) that later increments will refine when
// their owning mechanics land. intelligenceMultiplierBp carries the documented
// SUBMARINE_RESOLUTION_DEFERRED marker (DESIGN-29 unassigned).
//
// §12 coastal restriction: coastal subs get full local efficiency only in LOCAL;
// during war, normal movement limited to home area / one adjacent edge to support
// base / typed emergency redeployment; no chained exceptions or remote raiding.
//
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  type BaseProximityBand,
  type SubmarineType,
} from "./constants.js";
import {
  COASTAL_SUBMARINE_RANGE_RESTRICTED,
  SUBMARINE_RESOLUTION_DEFERRED,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// §11 authored multiplier defaults (all 10_000 = 1.0x, documented non-normative)

// base support availability multiplier. 10_000 bp = 1.0x neutral; refined when
// the base-support model lands (deferred per spec §3).
export const SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

// policy effectiveness multiplier. 10_000 bp = 1.0x neutral; refined when the
// per-policy effectiveness model lands (deferred).
export const SUBMARINE_POLICY_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

// intelligence effectiveness multiplier. 10_000 bp = 1.0x neutral; carries the
// SUBMARINE_RESOLUTION_DEFERRED marker because DESIGN-29 (intelligence) is
// unassigned and this value is a placeholder, not a normative §11 constant.
// MUST NOT be interpreted as DESIGN-29's shipped intelligence modifier.
export const SUBMARINE_INTELLIGENCE_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

// enemy protection effectiveness multiplier. 10_000 bp = 1.0x neutral; refined
// when the enemy-protection model lands (deferred).
export const SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

// blockade effectiveness multiplier. 10_000 bp = 1.0x neutral; refined when the
// full blockade model (DESIGN-32) lands (basic version landed in B10c, full
// model deferred per SPRINT-PLAN).
export const SUBMARINE_BLOCKADE_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

// §11 denominator: 10_000^7 for the seven basis-point multipliers.
const EFFECTIVENESS_DENOMINATOR = 10_000 ** 7;

// §11 formula invariants

function invariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
    code: SUBMARINE_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isNonNegativeBp(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v) && v >= 0 && v <= 20_000
  );
}

// §11: strategic mission effectiveness

export interface StrategicMissionEffectivenessInput {
  baseMissionStrength: SafeInt;
  typeRemoteEfficiencyBp: SafeInt;
  reliabilityMultiplierBp: SafeInt;
  baseSupportMultiplierBp?: SafeInt;
  policyMultiplierBp?: SafeInt;
  intelligenceMultiplierBp?: SafeInt;
  enemyProtectionMultiplierBp?: SafeInt;
  blockadeMultiplierBp?: SafeInt;
}

export function computeStrategicMissionEffectiveness(
  input: StrategicMissionEffectivenessInput,
): SafeInt {
  const base = input.baseMissionStrength;
  if (!SafeInt.isSafeInt(base) || base < (0 as SafeInt)) {
    return invariant(base, "baseMissionStrength", "must be a non-negative safe integer");
  }

  const reBp = input.typeRemoteEfficiencyBp;
  if (!isNonNegativeBp(reBp)) {
    return invariant(reBp, "typeRemoteEfficiencyBp", "must be a basis-point value [0, 20_000]");
  }

  const relBp = input.reliabilityMultiplierBp;
  if (!isNonNegativeBp(relBp)) {
    return invariant(relBp, "reliabilityMultiplierBp", "must be a basis-point value [0, 20_000]");
  }

  const bsBp = input.baseSupportMultiplierBp ?? SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP;
  if (!isNonNegativeBp(bsBp)) {
    return invariant(bsBp, "baseSupportMultiplierBp", "must be a basis-point value [0, 20_000]");
  }

  const polBp = input.policyMultiplierBp ?? SUBMARINE_POLICY_MULTIPLIER_BP;
  if (!isNonNegativeBp(polBp)) {
    return invariant(polBp, "policyMultiplierBp", "must be a basis-point value [0, 20_000]");
  }

  const intBp = input.intelligenceMultiplierBp ?? SUBMARINE_INTELLIGENCE_MULTIPLIER_BP;
  if (!isNonNegativeBp(intBp)) {
    return invariant(intBp, "intelligenceMultiplierBp", "must be a basis-point value [0, 20_000]");
  }

  const epBp = input.enemyProtectionMultiplierBp ?? SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP;
  if (!isNonNegativeBp(epBp)) {
    return invariant(
      epBp,
      "enemyProtectionMultiplierBp",
      "must be a basis-point value [0, 20_000]",
    );
  }

  const blkdBp = input.blockadeMultiplierBp ?? SUBMARINE_BLOCKADE_MULTIPLIER_BP;
  if (!isNonNegativeBp(blkdBp)) {
    return invariant(blkdBp, "blockadeMultiplierBp", "must be a basis-point value [0, 20_000]");
  }

  // Use BigInt for the full product to avoid precision loss above MAX_SAFE_INTEGER.
  // The denominator 10_000^7 = 10^28 exceeds Number.MAX_SAFE_INTEGER (~9*10^15),
  // and the product of up to 8 basis-point values (each ≤20_000) × base can reach
  // ~10^37, which requires BigInt. The final division result is always ≤ SafeInt
  // range because every multiplier starts at 10_000 bp (=1.0x) and the formula
  // divides by 10_000^7.
  const product =
    BigInt(base) *
    BigInt(reBp) *
    BigInt(relBp) *
    BigInt(bsBp) *
    BigInt(polBp) *
    BigInt(intBp) *
    BigInt(epBp) *
    BigInt(blkdBp);
  const denominator = BigInt(EFFECTIVENESS_DENOMINATOR);
  const result = Number(product / denominator);

  return SafeInt(result);
}

// §12: coastal range restriction

export type CoastalMovementKind =
  | "NORMAL_MOVEMENT_WITHIN_HOME_AREA"
  | "NORMAL_MOVEMENT_ADJACENT_TO_SUPPORT_BASE"
  | "EMERGENCY_REDEPLOYMENT"
  | "REMOTE_RAIDING"
  | "CHAINED_ADJACENT_EXCEPTION"
  | "NORMAL_MOVEMENT_OUTSIDE_WAR"
  | "NOT_COASTAL_TYPE";

export type CoastalRestrictionVerdict =
  | {
      restricted: false;
      movementKind: CoastalMovementKind;
      reasonCode: null;
    }
  | {
      restricted: true;
      movementKind: CoastalMovementKind;
      reasonCode: typeof COASTAL_SUBMARINE_RANGE_RESTRICTED;
      message: string;
    };

export interface CoastalMovementContext {
  submarineTypeId: SubmarineType;
  atWar: boolean;
  targetProximityBand: BaseProximityBand;
  isWithinHomeArea: boolean;
  isAdjacentToSupportBase: boolean;
  isEmergencyRedeployment: boolean;
}

export function evaluateCoastalRestriction(
  context: CoastalMovementContext,
): CoastalRestrictionVerdict {
  if (context.submarineTypeId !== "COASTAL") {
    return {
      restricted: false,
      movementKind: "NOT_COASTAL_TYPE",
      reasonCode: null,
    };
  }

  if (!context.atWar) {
    return {
      restricted: false,
      movementKind: "NORMAL_MOVEMENT_OUTSIDE_WAR",
      reasonCode: null,
    };
  }

  if (context.targetProximityBand !== "LOCAL") {
    return {
      restricted: true,
      movementKind: "REMOTE_RAIDING",
      reasonCode: COASTAL_SUBMARINE_RANGE_RESTRICTED,
      message:
        "coastal submarine remote raiding prohibited — COASTAL type may not operate outside LOCAL proximity band during war",
    };
  }

  if (context.isEmergencyRedeployment) {
    return {
      restricted: false,
      movementKind: "EMERGENCY_REDEPLOYMENT",
      reasonCode: null,
    };
  }

  if (context.isWithinHomeArea) {
    return {
      restricted: false,
      movementKind: "NORMAL_MOVEMENT_WITHIN_HOME_AREA",
      reasonCode: null,
    };
  }

  if (context.isAdjacentToSupportBase) {
    return {
      restricted: false,
      movementKind: "NORMAL_MOVEMENT_ADJACENT_TO_SUPPORT_BASE",
      reasonCode: null,
    };
  }

  return {
    restricted: true,
    movementKind: "CHAINED_ADJACENT_EXCEPTION",
    reasonCode: COASTAL_SUBMARINE_RANGE_RESTRICTED,
    message:
      "coastal submarine may not chain adjacent exceptions — only one adjacent edge to a support base is permitted",
  };
}

// §12: coastal full local efficiency check (used by §11 pre-multiplier gating)

export function coastalLocalEfficiencyOnly(
  submarineTypeId: SubmarineType,
  band: BaseProximityBand,
): boolean {
  if (submarineTypeId !== "COASTAL") return false;
  return band === "LOCAL";
}

// intelligenceMultiplierBp carries the SUBMARINE_RESOLUTION_DEFERRED marker

export const SUBMARINE_INTELLIGENCE_MULTIPLIER_DEFERRED_MARKER: typeof SUBMARINE_RESOLUTION_DEFERRED =
  SUBMARINE_RESOLUTION_DEFERRED;
