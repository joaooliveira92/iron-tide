import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import { RADAR_SATURATION_TABLE, radarMediumAaMarginalMultiplierBp } from "./constants.js";
import type { LayerId } from "./air-defense-system-definition.js";
import {
  RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE,
  RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE,
} from "./reasonCodes.js";

export const RADAR_NEUTRAL_FACTOR_BP = 10_000 as const;

export interface RadarDirectedMediumAaGroupPredicates {
  layer: LayerId;
  radarFireControlOperational: boolean;
  radarChannelAssigned: boolean;
  directorOperational: boolean;
  ammunitionAvailable: boolean;
  powerAvailable: boolean;
  distinctEngagementChannel: boolean;
}

export function isRadarDirectedMediumAaGroup(
  predicates: RadarDirectedMediumAaGroupPredicates,
): boolean {
  return (
    predicates.layer === "MEDIUM_AA" &&
    predicates.radarFireControlOperational &&
    predicates.radarChannelAssigned &&
    predicates.directorOperational &&
    predicates.ammunitionAvailable &&
    predicates.powerAvailable &&
    predicates.distinctEngagementChannel
  );
}

export function computeRadarFactorBp(radarDirectedGroupCount: number): SafeInt {
  if (!SafeInt.isSafeInt(radarDirectedGroupCount) || radarDirectedGroupCount < 0) {
    throw new BluewaveError(
      "computeRadarFactorBp: radarDirectedGroupCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, radarDirectedGroupCount },
    );
  }
  if (radarDirectedGroupCount === 0) {
    return SafeInt(RADAR_NEUTRAL_FACTOR_BP);
  }
  let sumBp = SafeInt.ZERO;
  const scheduleLength = RADAR_SATURATION_TABLE.length;
  const bounded = Math.min(radarDirectedGroupCount, scheduleLength);
  for (let n = 1; n <= bounded; n++) {
    sumBp = SafeInt.add(sumBp, SafeInt(radarMediumAaMarginalMultiplierBp(n)));
  }
  if (radarDirectedGroupCount > bounded) {
    sumBp = SafeInt.add(
      sumBp,
      SafeInt.mul(
        SafeInt(radarDirectedGroupCount - bounded),
        SafeInt(radarMediumAaMarginalMultiplierBp(bounded)),
      ),
    );
  }
  return sumBp;
}

export function radarSaturationMarkers(radarDirectedGroupCount: number): ReadonlyArray<string> {
  if (!SafeInt.isSafeInt(radarDirectedGroupCount) || radarDirectedGroupCount < 0) {
    throw new BluewaveError(
      "radarSaturationMarkers: radarDirectedGroupCount must be a non-negative safe integer",
      { code: INVALID_AIR_DEFENSE_STATE, radarDirectedGroupCount },
    );
  }
  if (radarDirectedGroupCount >= 9) {
    return [RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE];
  }
  if (radarDirectedGroupCount >= 5) {
    return [RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE];
  }
  return [];
}
