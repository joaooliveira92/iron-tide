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

export const SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

export const SUBMARINE_POLICY_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

export const SUBMARINE_INTELLIGENCE_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

export const SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

export const SUBMARINE_BLOCKADE_MULTIPLIER_BP: 10000 = SUBMARINE_BASIS_POINTS_PER_UNIT;

const EFFECTIVENESS_DENOMINATOR = 10_000 ** 7;

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

export function coastalLocalEfficiencyOnly(
  submarineTypeId: SubmarineType,
  band: BaseProximityBand,
): boolean {
  if (submarineTypeId !== "COASTAL") return false;
  return band === "LOCAL";
}

export const SUBMARINE_INTELLIGENCE_MULTIPLIER_DEFERRED_MARKER: typeof SUBMARINE_RESOLUTION_DEFERRED =
  SUBMARINE_RESOLUTION_DEFERRED;
