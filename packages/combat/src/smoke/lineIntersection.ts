//packages/combat/src/smoke/lineIntersection.ts
// DESIGN-42 §9: line-of-sight intersection with smoke clouds.

import {
  SMOKESCREEN_REFERENCE_WIDTH_M,
  SMOKE_REFERENCE_PATH_LENGTH,
  SMOKE_OPTICAL_NUMERATOR,
  SMOKE_OPTICAL_DENOMINATOR,
  SMOKE_OPTICAL_MIN,
} from "./constants.js";
import type { SmokeCloud } from "./model.js";

export interface SmokeLineIntersectionResult {
  pathDensityContributions: Array<{ cloudId: string; contributionBp: number }>;
  totalPathDensityBp: number;
  smokeOpticalMultiplierBp: number;
}

const CLOUD_RADIUS_M = SMOKESCREEN_REFERENCE_WIDTH_M / 2;

function closestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): [number, number] {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) {
    return [a[0], a[1]];
  }
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  let t = (apx * abx + apy * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * abx, a[1] + t * aby];
}

function distanceBetween(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeLineSmokeIntersection(
  start: [number, number],
  end: [number, number],
  clouds: SmokeCloud[],
): SmokeLineIntersectionResult {
  const contributions: Array<{ cloudId: string; contributionBp: number }> = [];
  let totalPathDensityBp = 0;

  for (const cloud of clouds) {
    const closest = closestPointOnSegment(cloud.centroidPosition, start, end);
    const dist = distanceBetween(cloud.centroidPosition, closest);

    if (dist < CLOUD_RADIUS_M) {
      // Compute chord length inside the circle
      const halfChord = Math.sqrt(Math.max(0, CLOUD_RADIUS_M * CLOUD_RADIUS_M - dist * dist));
      const chordLength = 2 * halfChord;

      // Contribution = density * (chord / reference path)
      const contributionBp = Math.floor(
        (cloud.densityBp * chordLength) / Math.max(1, SMOKE_REFERENCE_PATH_LENGTH),
      );

      contributions.push({ cloudId: cloud.smokeCloudId, contributionBp });
      totalPathDensityBp += contributionBp;
    }
  }

  // Clamp total to [0, 10_000]
  totalPathDensityBp = Math.max(0, Math.min(10_000, totalPathDensityBp));

  // Compute optical multiplier
  const rawMultiplier =
    10_000 - Math.floor((totalPathDensityBp * SMOKE_OPTICAL_NUMERATOR) / SMOKE_OPTICAL_DENOMINATOR);
  const smokeOpticalMultiplierBp = Math.max(SMOKE_OPTICAL_MIN, rawMultiplier);

  return {
    pathDensityContributions: contributions,
    totalPathDensityBp,
    smokeOpticalMultiplierBp,
  };
}
