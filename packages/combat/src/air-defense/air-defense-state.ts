import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { AIR_DEFENSE_MODEL_VERSION, INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import type { AirDefenseSystemDefinition, LayerId } from "./air-defense-system-definition.js";

function byEntryKey(a: readonly [string, unknown], b: readonly [string, unknown]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

export const DisruptionSeverity = {
  LIGHT: "LIGHT" as const,
  MODERATE: "MODERATE" as const,
  SEVERE: "SEVERE" as const,
  MISSION_ABORT: "MISSION_ABORT" as const,
} as const;

export type DisruptionSeverityType = (typeof DisruptionSeverity)[keyof typeof DisruptionSeverity];

export interface DisruptionRecord {
  severity: DisruptionSeverityType;
  bp: SafeInt;
  timestampMs: SafeInt;
  layer: LayerId;
}

export interface DirectorState {
  channelId: string;
  assignedLayer: LayerId;
  directorIndex: SafeInt;
  scalingBp: SafeInt;
}

export interface RadarState {
  channelId: string;
  assignedLayer: LayerId;
  saturationGroup: SafeInt;
  diminishingReturnsBp: SafeInt;
}

export interface AirDefenseState {
  defenderId: string;
  scope: "SHIP" | "FLEET" | "BASE";
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  directorState: DirectorState;
  radarState: RadarState;
  crewQuality: SafeInt;
  damageBp: SafeInt;
  powerBp: SafeInt;
  ammunitionByType: ReadonlyMap<string, SafeInt>;
  targetAllocations: ReadonlyMap<string, string>;
  channelReservations: ReadonlyMap<string, string>;
  disruptionRecords: ReadonlyArray<DisruptionRecord>;
  stateHash: string;
}

export function computeAirDefenseStateHash(state: AirDefenseState): string {
  const { stateHash: _sh, ...rest } = state;

  const body = {
    defenderId: rest.defenderId,
    scope: rest.scope,
    systems: rest.systems.map((sys) => ({
      systemId: sys.systemId,
      layer: sys.layer,
      category: sys.category,
      mountCount: sys.mountCount,
      barrels: sys.barrels,
      rangeMinM: sys.rangeMinM,
      rangeMaxM: sys.rangeMaxM,
      altitudeMinM: sys.altitudeMinM,
      altitudeMaxM: sys.altitudeMaxM,
      targetSpeedLimitMps: sys.targetSpeedLimitMps,
      arcDegreesMax: sys.arcDegreesMax,
      profileEligibility: Array.from(sys.profileEligibility).sort(),
      fireControl: {
        trackingRangeM: sys.fireControl.trackingRangeM,
        maxElevationDegrees: sys.fireControl.maxElevationDegrees,
        updateRateHz: sys.fireControl.updateRateHz,
      },
      radar: {
        frequencyBand: sys.radar.frequencyBand,
        peakPowerW: sys.radar.peakPowerW,
        maxRangeM: sys.radar.maxRangeM,
        resolutionDegrees: sys.radar.resolutionDegrees,
      },
      engagementChannels: Array.from(sys.engagementChannels).sort(),
      baseKillBp: sys.baseKillBp,
      baseDamageBp: sys.baseDamageBp,
      baseAbortBp: sys.baseAbortBp,
      baseDisruptionBp: sys.baseDisruptionBp,
      rate: sys.rate,
      roundsPerEngagement: sys.roundsPerEngagement,
      magazineCapacity: sys.magazineCapacity,
      localControlSupported: sys.localControlSupported,
      saturationGroup: sys.saturationGroup,
      contentVersion: sys.contentVersion,
      contentHash: sys.contentHash,
    })),
    directorState: {
      channelId: rest.directorState.channelId,
      assignedLayer: rest.directorState.assignedLayer,
      directorIndex: rest.directorState.directorIndex,
      scalingBp: rest.directorState.scalingBp,
    },
    radarState: {
      channelId: rest.radarState.channelId,
      assignedLayer: rest.radarState.assignedLayer,
      saturationGroup: rest.radarState.saturationGroup,
      diminishingReturnsBp: rest.radarState.diminishingReturnsBp,
    },
    crewQuality: rest.crewQuality,
    damageBp: rest.damageBp,
    powerBp: rest.powerBp,
    ammunitionByType: Array.from(rest.ammunitionByType.entries()).sort(byEntryKey),
    targetAllocations: Array.from(rest.targetAllocations.entries()).sort(byEntryKey),
    channelReservations: Array.from(rest.channelReservations.entries()).sort(byEntryKey),
    disruptionRecords: rest.disruptionRecords.map((rec) => ({
      severity: rec.severity,
      bp: rec.bp,
      timestampMs: rec.timestampMs,
      layer: rec.layer,
    })),
  };

  const envelope = createEnvelope("air-defense-state", AIR_DEFENSE_MODEL_VERSION, body);
  return envelope.bodyHash;
}

export function createAirDefenseState(
  defenderId: string,
  scope: "SHIP" | "FLEET" | "BASE",
  systems: ReadonlyArray<AirDefenseSystemDefinition>,
  directorState: DirectorState,
  radarState: RadarState,
  crewQuality: SafeInt,
): AirDefenseState {
  if (typeof defenderId !== "string" || defenderId.length === 0) {
    throw new BluewaveError("defenderId must be a non-empty string", {
      code: INVALID_AIR_DEFENSE_STATE,
    });
  }

  if (!["SHIP", "FLEET", "BASE"].includes(scope)) {
    throw new BluewaveError("scope must be one of: SHIP, FLEET, BASE", {
      code: INVALID_AIR_DEFENSE_STATE,
      scope,
    });
  }

  if (!Array.isArray(systems) || systems.length === 0) {
    throw new BluewaveError("systems must be a non-empty array", {
      code: INVALID_AIR_DEFENSE_STATE,
    });
  }

  for (const sys of systems) {
    validateAirDefenseSystemDefinition(sys);
  }

  const state: AirDefenseState = {
    defenderId,
    scope,
    systems,
    directorState,
    radarState,
    crewQuality,
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt.ZERO,
    ammunitionByType: new Map<string, SafeInt>(
      systems.map((sys) => [sys.systemId, sys.magazineCapacity] as const),
    ),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
  };

  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

export function addDisruptionRecord(
  state: AirDefenseState,
  severity: DisruptionSeverityType,
  bp: SafeInt,
  layer: LayerId,
): AirDefenseState {
  const disruptionRecord: DisruptionRecord = {
    severity,
    bp,
    timestampMs: SafeInt.ZERO,
    layer,
  };

  const newDisruptionRecords = [...state.disruptionRecords, disruptionRecord];
  const newState: AirDefenseState = {
    ...state,
    disruptionRecords: newDisruptionRecords,
  };

  newState.stateHash = computeAirDefenseStateHash(newState);
  return newState;
}

export function isValidDisruptionSeverity(severity: string): severity is DisruptionSeverityType {
  return ["LIGHT", "MODERATE", "SEVERE", "MISSION_ABORT"].includes(severity);
}

import { validateAirDefenseSystemDefinition } from "./air-defense-system-definition.js";
