import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  BASE_EFFECTIVENESS_BP,
  COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT,
  COASTAL_DEFENSE_FORMULA_VERSION,
  type LandTargetType,
} from "./constants.js";
import { COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING } from "./reasonCodes.js";

export interface CoastalArtilleryEffectivenessInput {
  readonly caliberMm: SafeInt;
  readonly hasAA: boolean;
  readonly targetType: LandTargetType;
  readonly damageMultiplierBp: SafeInt;
  readonly seaStateMultiplierBp: SafeInt;
}

export function coastalArtilleryEffectivenessBp(
  input: CoastalArtilleryEffectivenessInput,
): SafeInt {
  const base = SafeInt(BASE_EFFECTIVENESS_BP);
  const calFactor = SafeInt(Math.floor(input.caliberMm.valueOf() / 100));
  const targetBp = targetTypeEffectivenessBp(input.targetType);

  const product =
    BigInt(base.valueOf()) *
    BigInt(calFactor.valueOf()) *
    BigInt(input.damageMultiplierBp.valueOf()) *
    BigInt(input.seaStateMultiplierBp.valueOf()) *
    BigInt(targetBp.valueOf());

  const denominator =
    BigInt(COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT) *
    BigInt(COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT) *
    BigInt(COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT);

  const result = Number(product / denominator);
  return SafeInt(result);
}

function targetTypeEffectivenessBp(targetType: LandTargetType): SafeInt {
  switch (targetType) {
    case "COASTAL_BATTERY":
    case "RADAR_STATION":
      return SafeInt(10_000);
    case "AIRFIELD":
    case "DOCKYARD":
    case "PORT_INSTALLATION":
      return SafeInt(8_000);
    case "FUEL_STORAGE":
      return SafeInt(7_500);
    case "TRANSPORT_CONCENTRATION":
      return SafeInt(6_000);
    default:
      throw new BluewaveError(COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING, {
        code: COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING,
        targetType,
        reason: `unknown target type in effectiveness formula`,
      });
  }
}

export const effectivenessConstants = {
  targetTypeBp: {
    COASTAL_BATTERY: 10_000,
    RADAR_STATION: 10_000,
    AIRFIELD: 8_000,
    DOCKYARD: 8_000,
    PORT_INSTALLATION: 8_000,
    FUEL_STORAGE: 7_500,
    TRANSPORT_CONCENTRATION: 6_000,
  } as Record<string, number>,
  formulaVersion: COASTAL_DEFENSE_FORMULA_VERSION,
} as const;
