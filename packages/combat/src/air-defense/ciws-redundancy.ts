import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import { CIWS_REDUNDANCY_TABLE, ciwsMarginalMultiplierBp } from "./constants.js";
import { CIWS_DIMINISHING_RETURNS_ACTIVE, CIWS_STRONG_REDUNDANCY_ACTIVE } from "./reasonCodes.js";

export const CIWS_NEUTRAL_FACTOR_BP = 10_000 as const;

export function isCiwsContributingSystem(input: {
  damaged: boolean;
  unpowered: boolean;
  empty: boolean;
  jammed: boolean;
  outOfArc: boolean;
}): boolean {
  return !(input.damaged || input.unpowered || input.empty || input.jammed || input.outOfArc);
}

export function computeCiwsSaturationFactorBp(ciwsSystemCount: number): SafeInt {
  if (!SafeInt.isSafeInt(ciwsSystemCount) || ciwsSystemCount < 0) {
    throw new BluewaveError(
      "computeCiwsSaturationFactorBp: ciwsSystemCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, ciwsSystemCount },
    );
  }
  if (ciwsSystemCount === 0) {
    return SafeInt(CIWS_NEUTRAL_FACTOR_BP);
  }
  let sumBp = SafeInt.ZERO;
  const scheduleLength = CIWS_REDUNDANCY_TABLE.length;
  const bounded = Math.min(ciwsSystemCount, scheduleLength);
  for (let n = 1; n <= bounded; n++) {
    sumBp = SafeInt.add(sumBp, SafeInt(ciwsMarginalMultiplierBp(n)));
  }
  if (ciwsSystemCount > bounded) {
    sumBp = SafeInt.add(
      sumBp,
      SafeInt.mul(SafeInt(ciwsSystemCount - bounded), SafeInt(ciwsMarginalMultiplierBp(bounded))),
    );
  }
  return sumBp;
}

export function ciwsSaturationMarkers(ciwsSystemCount: number): ReadonlyArray<string> {
  if (!SafeInt.isSafeInt(ciwsSystemCount) || ciwsSystemCount < 0) {
    throw new BluewaveError(
      "ciwsSaturationMarkers: ciwsSystemCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, ciwsSystemCount },
    );
  }
  if (ciwsSystemCount >= 7) {
    return [CIWS_STRONG_REDUNDANCY_ACTIVE];
  }
  if (ciwsSystemCount >= 5) {
    return [CIWS_DIMINISHING_RETURNS_ACTIVE];
  }
  return [];
}
