//packages/combat/src/smoke/driftDecay.ts
// DESIGN-42 §8: smoke drift and decay per minute.

import {
  WIND_RETENTION_LT_5_BP,
  WIND_RETENTION_5_TO_15_BP,
  WIND_RETENTION_15_TO_25_BP,
  WIND_RETENTION_GE_25_BP,
  SMOKESCREEN_REFERENCE_WIDTH_M,
} from "./constants.js";
import { smokeCloudHash } from "./model.js";
import type { SmokeCloud } from "./model.js";

export function getWindRetentionMultiplier(windSpeedKnots: number): number {
  if (windSpeedKnots < 5) {
    return WIND_RETENTION_LT_5_BP;
  }
  if (windSpeedKnots < 15) {
    return WIND_RETENTION_5_TO_15_BP;
  }
  if (windSpeedKnots < 25) {
    return WIND_RETENTION_15_TO_25_BP;
  }
  return WIND_RETENTION_GE_25_BP;
}

export const SMOKE_MERGE_PROXIMITY_M = SMOKESCREEN_REFERENCE_WIDTH_M;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceBetween(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function computeDriftVector(windDirectionDeg: number, windSpeedKnots: number): [number, number] {
  const rad = toRadians(windDirectionDeg);
  const dx = Math.sin(rad) * windSpeedKnots;
  const dy = Math.cos(rad) * windSpeedKnots;
  return [dx, dy];
}

export interface ResolveSmokeDriftDecayResult {
  nextClouds: SmokeCloud[];
  removedCloudIds: string[];
}

export function resolveSmokeDriftDecay(
  clouds: SmokeCloud[],
  windSpeedKnots: number,
  windDirection: number,
  precipitationIntensityBp?: number,
): ResolveSmokeDriftDecayResult {
  const retentionMultiplier = getWindRetentionMultiplier(windSpeedKnots);
  const driftVector = computeDriftVector(windDirection, windSpeedKnots);
  const removedCloudIds: string[] = [];
  const survivors: SmokeCloud[] = [];

  for (const cloud of clouds) {
    if (!cloud.active) {
      removedCloudIds.push(cloud.smokeCloudId);
      continue;
    }

    // Step 1: translate by wind vector
    const newX = cloud.centroidPosition[0] + driftVector[0];
    const newY = cloud.centroidPosition[1] + driftVector[1];
    const newPosition: [number, number] = [newX, newY];

    // Step 2: apply density retention
    let newDensity = Math.floor((cloud.densityBp * retentionMultiplier) / 10_000);

    // Step 3: apply precipitation decay modifier
    if (precipitationIntensityBp !== undefined) {
      newDensity = Math.floor((newDensity * precipitationIntensityBp) / 10_000);
    }

    // Step 5: check removal
    if (newDensity < 1) {
      removedCloudIds.push(cloud.smokeCloudId);
      continue;
    }

    survivors.push({
      ...cloud,
      centroidPosition: newPosition,
      densityBp: newDensity,
    });
  }

  // Step 4: merge clouds with same owner and position proximity
  const merged = mergeCloudsByProximity(survivors);

  // Step 6: recompute cloudHash for each surviving cloud
  const nextClouds: SmokeCloud[] = [];
  for (const cloud of merged) {
    const newHash = smokeCloudHash({
      sourceType: cloud.sourceType,
      sourceId: cloud.sourceId,
      owner: cloud.owner,
      creationMinute: cloud.creationMinute,
      creationSubstep: cloud.creationSubstep,
      centroidPosition: cloud.centroidPosition,
      densityBp: cloud.densityBp,
      verticalExtentM: cloud.verticalExtentM,
      driftVector: cloud.driftVector,
      expansionRate: cloud.expansionRate,
      densityDecayRate: cloud.densityDecayRate,
      fuelComposition: cloud.fuelComposition,
      active: cloud.active,
    });

    nextClouds.push({
      ...cloud,
      cloudHash: newHash,
    });
  }

  return { nextClouds, removedCloudIds };
}

function mergeCloudsByProximity(clouds: SmokeCloud[]): SmokeCloud[] {
  if (clouds.length < 2) {
    return clouds;
  }

  const result: SmokeCloud[] = [];
  const used = new Set<string>();

  for (let i = 0; i < clouds.length; i++) {
    const a = clouds[i]!;
    if (used.has(a.smokeCloudId)) {
      continue;
    }
    used.add(a.smokeCloudId);

    let mergedDensityBp = a.densityBp;
    let mergedPosX = a.centroidPosition[0];
    let mergedPosY = a.centroidPosition[1];

    for (let j = i + 1; j < clouds.length; j++) {
      const b = clouds[j]!;
      if (used.has(b.smokeCloudId)) {
        continue;
      }
      if (a.owner !== b.owner) {
        continue;
      }
      const dist = distanceBetween([mergedPosX, mergedPosY], b.centroidPosition);
      if (dist < SMOKE_MERGE_PROXIMITY_M) {
        // Merge: weighted average position, summed density capped at 10_000
        const totalWeight = mergedDensityBp + b.densityBp;
        const w1 = totalWeight > 0 ? mergedDensityBp / totalWeight : 0.5;
        const w2 = totalWeight > 0 ? b.densityBp / totalWeight : 0.5;
        mergedPosX = mergedPosX * w1 + b.centroidPosition[0] * w2;
        mergedPosY = mergedPosY * w1 + b.centroidPosition[1] * w2;
        mergedDensityBp = Math.min(10_000, mergedDensityBp + b.densityBp);
        used.add(b.smokeCloudId);
      }
    }

    const mergedCloud: SmokeCloud = {
      smokeCloudId: a.smokeCloudId,
      sourceType: a.sourceType,
      sourceId: a.sourceId,
      owner: a.owner,
      creationMinute: a.creationMinute,
      creationSubstep: a.creationSubstep,
      centroidPosition: [mergedPosX, mergedPosY],
      densityBp: mergedDensityBp,
      verticalExtentM: a.verticalExtentM,
      driftVector: a.driftVector,
      expansionRate: a.expansionRate,
      densityDecayRate: a.densityDecayRate,
      fuelComposition: a.fuelComposition,
      active: a.active,
      rulesetVersion: a.rulesetVersion,
      formulaVersion: a.formulaVersion,
      cloudHash: a.cloudHash,
    };
    result.push(mergedCloud);
  }

  return result;
}
