//packages/combat/src/smoke/engineWiring.ts
// Step 5.5 resolveSmoke — called after movement_intent but before propulsion.
// Takes current smoke clouds + weather context + battle state.
// Returns updated clouds + event records.
//
// Pure/deterministic: no ambient I/O/clock/random.
// Integer fixed-point arithmetic only.

import type { SmokeCloud } from "./model.js";
import { resolveSmokeDriftDecay } from "./driftDecay.js";
import { createSmokeEventRecord, type SmokeEventRecord } from "./smokeRecords.js";

// ---------------------------------------------------------------------------
// Context and result types

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

// ---------------------------------------------------------------------------
// resolveSmoke — per-minute smoke lifecycle stage

export function resolveSmoke(
  context: SmokeContext,
  battleMinute: number,
  substep: number,
): SmokeStageResult {
  const events: SmokeEventRecord[] = [];

  // Step 1: Run drift and decay on all active clouds
  const { nextClouds, removedCloudIds } = resolveSmokeDriftDecay(
    context.clouds,
    context.windSpeedKnots,
    context.windDirection,
    context.precipitationIntensityBp,
  );

  // Step 2: Create SMOKE_SOURCE_REMOVAL records for removed clouds
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

  // Step 3: Create DRIFT_DECAY records for surviving clouds
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
