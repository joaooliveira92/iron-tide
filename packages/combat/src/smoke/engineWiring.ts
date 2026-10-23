import type { SmokeCloud } from "./model.js";
import { resolveSmokeDriftDecay } from "./driftDecay.js";
import { createSmokeEventRecord, type SmokeEventRecord } from "./smokeRecords.js";

export interface SmokeContext {
  clouds: SmokeCloud[];
  windSpeedKnots: number;
  windDirection: number;
  precipitationIntensityBp: number;
}

export interface SmokeStageResult {
  nextClouds: SmokeCloud[];
  events: SmokeEventRecord[];
}

export function resolveSmoke(
  context: SmokeContext,
  battleMinute: number,
  substep: number,
): SmokeStageResult {
  const events: SmokeEventRecord[] = [];

  const { nextClouds, removedCloudIds } = resolveSmokeDriftDecay(
    context.clouds,
    context.windSpeedKnots,
    context.windDirection,
    context.precipitationIntensityBp,
  );

  const removedCloudMap = new Map<string, SmokeCloud>();
  for (const cloud of context.clouds) {
    removedCloudMap.set(cloud.smokeCloudId, cloud);
  }

  for (const removedId of removedCloudIds) {
    const cloud = removedCloudMap.get(removedId);
    if (cloud) {
      events.push(
        createSmokeEventRecord({
          kind: "SMOKE_SOURCE_REMOVAL",
          battleMinute,
          substep,
          sourceType: cloud.sourceType,
          sourceId: cloud.sourceId,
          cloudId: cloud.smokeCloudId,
          position: cloud.centroidPosition,
          densityBp: 0,
          weatherContext: {
            windSpeedKnots: context.windSpeedKnots,
            windDirection: context.windDirection,
            precipitationIntensityBp: context.precipitationIntensityBp,
          },
        }),
      );
    }
  }

  for (const cloud of nextClouds) {
    events.push(
      createSmokeEventRecord({
        kind: "DRIFT_DECAY",
        battleMinute,
        substep,
        sourceType: cloud.sourceType,
        sourceId: cloud.sourceId,
        cloudId: cloud.smokeCloudId,
        position: cloud.centroidPosition,
        densityBp: cloud.densityBp,
        weatherContext: {
          windSpeedKnots: context.windSpeedKnots,
          windDirection: context.windDirection,
          precipitationIntensityBp: context.precipitationIntensityBp,
        },
      }),
    );
  }

  return { nextClouds, events };
}

export type { SmokeCloud } from "./model.js";
export type { SmokeEventRecord } from "./smokeRecords.js";
