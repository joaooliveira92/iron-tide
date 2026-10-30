import { DIRECTION_TABLE } from "../movement/directionTable.js";
import { DIRECTION_FIXED } from "../movement/constants.js";
import { directionBp } from "../movement/kinematics.js";
import type { DivisionFormation } from "../tactical/division.js";
import type { FormationKeepingRuleset, StationPoint } from "./contracts.js";

const UM_PER_M = 1_000_000;

export function bearingDeg(dxUm: number, dyUm: number): number {
  const dx = Math.round(dxUm / UM_PER_M);
  const dy = Math.round(dyUm / UM_PER_M);
  let best = 0;
  let bestDot = Number.NEGATIVE_INFINITY;
  for (let h = 0; h < DIRECTION_TABLE.length; h++) {
    const [cosBp, sinBp] = DIRECTION_TABLE[h]!;
    const dot = dx * cosBp + dy * sinBp;
    if (dot > bestDot) {
      bestDot = dot;
      best = h;
    }
  }
  return best;
}

export function distanceM(from: StationPoint, to: StationPoint): number {
  const dx = Math.round((to[0] - from[0]) / UM_PER_M);
  const dy = Math.round((to[1] - from[1]) / UM_PER_M);
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

export function alongHeadingUm(heading: number, from: StationPoint, to: StationPoint): number {
  const { cosBp, sinBp } = directionBp(heading);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return Math.round((dx * cosBp + dy * sinBp) / DIRECTION_FIXED);
}

export interface StationRequest {
  formation: DivisionFormation;
  ordinal: number;
  divisionIndex: number;
  leadPosition: StationPoint;
  leadHeading: number;
}

export function stationPoint(
  request: StationRequest,
  ruleset: FormationKeepingRuleset,
): StationPoint {
  let aheadUm = 0;
  let abeamUm = 0;
  switch (request.formation) {
    case "LINE_AHEAD":
      aheadUm = -request.ordinal * ruleset.columnIntervalUm;
      break;
    case "LINE_ABREAST":
      abeamUm = request.ordinal * ruleset.abreastIntervalUm;
      break;
    case "SEARCH_LINE":
      abeamUm = request.ordinal * ruleset.searchLineIntervalUm;
      break;
    case "SCREEN":
      aheadUm = -request.ordinal * ruleset.columnIntervalUm;
      abeamUm = request.divisionIndex * ruleset.divisionGapUm;
      break;
  }
  const { cosBp, sinBp } = directionBp(request.leadHeading);
  return [
    request.leadPosition[0] +
      Math.round((aheadUm * cosBp) / DIRECTION_FIXED) -
      Math.round((abeamUm * sinBp) / DIRECTION_FIXED),
    request.leadPosition[1] +
      Math.round((aheadUm * sinBp) / DIRECTION_FIXED) +
      Math.round((abeamUm * cosBp) / DIRECTION_FIXED),
  ];
}
