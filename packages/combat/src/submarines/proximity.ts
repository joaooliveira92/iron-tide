import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  type BaseProximityBand,
  type SubmarineType,
  SUBMARINE_BASIS_POINTS_PER_UNIT,
} from "./constants.js";
import {
  SUBMARINE_STATE_INVARIANT_FAILED,
  LONG_RANGE_ASW_VULNERABILITY_MISSING,
} from "./reasonCodes.js";
import {
  SUBMARINE_ASW_VULNERABILITY_BP,
  SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP,
  SUBMARINE_REMOTE_EFFICIENCY_BP,
} from "./model.js";

function invariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
    code: SUBMARINE_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function proximityBandForRouteDistance(distance: SafeInt): BaseProximityBand {
  if (typeof distance !== "number" || !Number.isInteger(distance) || distance < 0) {
    return invariant(distance, "distance", "route distance must be a non-negative integer");
  }
  if (distance <= 1) return "LOCAL";
  if (distance <= 3) return "REGIONAL";
  if (distance <= 6) return "REMOTE";
  return "EXTREME_REMOTE";
}

export function submarineRemoteEfficiencyBp(
  submarineTypeId: SubmarineType,
  band: BaseProximityBand,
): SafeInt {
  const row = SUBMARINE_REMOTE_EFFICIENCY_BP[submarineTypeId];
  if (!row) {
    return invariant(
      submarineTypeId,
      "type",
      "unknown submarine type for §9 remote-efficiency lookup",
    );
  }
  const value = row[band];
  if (typeof value !== "number" || value < 0 || value > 12_500) {
    return invariant(
      { submarineTypeId, band, value },
      "remoteEfficiency",
      "§9 remote-efficiency value outside valid [0, 12_500] bp range",
    );
  }
  return SafeInt(value);
}

export function submarineAswVulnerabilityBp(band: BaseProximityBand): SafeInt {
  const value = SUBMARINE_ASW_VULNERABILITY_BP[band];
  const validRangeMin = SUBMARINE_BASIS_POINTS_PER_UNIT;
  const validRangeMax = 12_500;
  if (typeof value !== "number" || value < validRangeMin || value > validRangeMax) {
    throw new BluewaveError(LONG_RANGE_ASW_VULNERABILITY_MISSING, {
      code: LONG_RANGE_ASW_VULNERABILITY_MISSING,
      reason: `§10 ASW vulnerability value ${value} outside [${validRangeMin}, ${validRangeMax}] bp`,
      band,
      value,
    });
  }
  return SafeInt(value);
}

export function submarineNeutralAswVulnerabilityBp(): SafeInt {
  return SafeInt(SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP);
}

export function registeredAswVulnerabilityBp(
  submarineTypeId: SubmarineType,
  band: BaseProximityBand,
  isLongRangeType: boolean,
): SafeInt {
  if (isLongRangeType) {
    return submarineAswVulnerabilityBp(band);
  }
  return submarineNeutralAswVulnerabilityBp();
}
