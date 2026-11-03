import { DIRECTION_FIXED } from "../movement/constants.js";
import { directionBp } from "../movement/kinematics.js";
import type { FormationTrack, StationPoint } from "./contracts.js";

export function appendTrackPoint(
  track: FormationTrack,
  point: StationPoint,
  capacity: number,
): FormationTrack {
  const last = track.points[track.points.length - 1];
  if (last !== undefined && last[0] === point[0] && last[1] === point[1]) return track;
  const points = [...track.points, [point[0], point[1]] as const];
  return {
    divisionId: track.divisionId,
    points: points.length > capacity ? points.slice(points.length - capacity) : points,
  };
}

export function pointAtPathDistance(
  points: readonly StationPoint[],
  distanceUm: number,
  headingBeforeTrack: number,
): StationPoint | undefined {
  if (points.length === 0) return undefined;
  let remaining = distanceUm;
  for (let i = points.length - 1; i > 0; i--) {
    const newer = points[i]!;
    const older = points[i - 1]!;
    const dx = older[0] - newer[0];
    const dy = older[1] - newer[1];
    const length = Math.round(Math.sqrt(dx * dx + dy * dy));
    if (length >= remaining) {
      if (length === 0) return newer;
      return [
        newer[0] + Math.round((dx * remaining) / length),
        newer[1] + Math.round((dy * remaining) / length),
      ];
    }
    remaining -= length;
  }
  const oldest = points[0]!;
  const next = points[1];
  const dx = next === undefined ? 0 : oldest[0] - next[0];
  const dy = next === undefined ? 0 : oldest[1] - next[1];
  const length = Math.round(Math.sqrt(dx * dx + dy * dy));
  if (length > 0) {
    return [
      oldest[0] + Math.round((dx * remaining) / length),
      oldest[1] + Math.round((dy * remaining) / length),
    ];
  }
  const { cosBp, sinBp } = directionBp(headingBeforeTrack);
  return [
    oldest[0] - Math.round((remaining * cosBp) / DIRECTION_FIXED),
    oldest[1] - Math.round((remaining * sinBp) / DIRECTION_FIXED),
  ];
}
