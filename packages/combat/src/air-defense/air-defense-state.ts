// D-4 M4 Aviation: Air Defense — AirDefenseState interface
// per DESIGN-45 §2. Deterministic state hash computation.
// Parallel to strike-state.ts pattern.

import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { AIR_DEFENSE_MODEL_VERSION, INVALID_AIR_DEFENSE_STATE } from "./constants.js";
import type { AirDefenseSystemDefinition, LayerId } from "./air-defense-system-definition.js";

// Comparator for deterministic sorting of [key, value] map entries by key.
function byEntryKey(a: readonly [string, unknown], b: readonly [string, unknown]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

// ---- Disruption severity levels ----

export const DisruptionSeverity = {
  LIGHT: "LIGHT" as const,
  MODERATE: "MODERATE" as const,
  SEVERE: "SEVERE" as const,
  MISSION_ABORT: "MISSION_ABORT" as const,
} as const;

export type DisruptionSeverityType = (typeof DisruptionSeverity)[keyof typeof DisruptionSeverity];

// ---- Disruption record ----

export interface DisruptionRecord {
  severity: DisruptionSeverityType;
  bp: SafeInt; // basis points value associated with severity
  timestampMs: SafeInt; // deterministic epoch-based value
  layer: LayerId;
}

// ---- Director/Radar state ----

export interface DirectorState {
  channelId: string;
  assignedLayer: LayerId;
  directorIndex: SafeInt;
  scalingBp: SafeInt; // value from DIRECTOR_SCALING_TABLE
}

export interface RadarState {
  channelId: string;
  assignedLayer: LayerId;
  saturationGroup: SafeInt;
  diminishingReturnsBp: SafeInt; // from RADAR_SATURATION_TABLE
}

// ---- AirDefenseState interface ----

export interface AirDefenseState {
  defenderId: string;
  scope: "SHIP" | "FLEET" | "BASE";
  systems: ReadonlyArray<AirDefenseSystemDefinition>;
  directorState: DirectorState;
  radarState: RadarState;
  crewQuality: SafeInt;
  damageBp: SafeInt; // cumulative damage in basis points
  powerBp: SafeInt; // cumulative power in basis points
  ammunitionByType: ReadonlyMap<string, SafeInt>; // type → rounds remaining
  targetAllocations: ReadonlyMap<string, string>; // targetId → systemId
  channelReservations: ReadonlyMap<string, string>; // channelId → systemId
  disruptionRecords: ReadonlyArray<DisruptionRecord>;
  stateHash: string;
}

// ---- Deterministic state hash computation ----

/**
 * Computes a deterministic hash for an AirDefenseState.
 * Excludes the stateHash field itself from the hash computation.
 *
 * @param state - The air defense state to hash.
 * @returns Hex-encoded SHA-256 hash string.
 */
export function computeAirDefenseStateHash(state: AirDefenseState): string {
  const { stateHash: _sh, ...rest } = state;

  // Order keys deterministically for hashing
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

// ---- createAirDefenseState ----

/**
 * Creates a new AirDefenseState with initial defaults.
 *
 * @param defenderId - Unique identifier for the defender (ship ID).
 * @param scope - Scope: "SHIP", "FLEET", or "BASE".
 * @param systems - Ordered array of AirDefenseSystemDefinition.
 * @param directorState - Director state.
 * @param radarState - Radar state.
 * @param crewQuality - Crew quality basis points (0-10_000).
 * @returns A valid initial AirDefenseState with computed stateHash.
 *
 * Each defense system's magazine is seeded to its `magazineCapacity` (the initial ready
 * load, §20 "magazine or ready-service capacity"), so states built through this constructor
 * carry explicit, authoritative ammunition reserves by default ("Every engagement MUST
 * reserve and consume exact ammunition", §20 line 334; §29.21 "magazines are explicit and
 * authoritative"). Callers who construct states directly may omit entries — ammunition.ts
 * treats an absent entry as an explicit documented opt-in for the "present supply" model.
 */
export function createAirDefenseState(
  defenderId: string,
  scope: "SHIP" | "FLEET" | "BASE",
  systems: ReadonlyArray<AirDefenseSystemDefinition>,
  directorState: DirectorState,
  radarState: RadarState,
  crewQuality: SafeInt,
): AirDefenseState {
  // Validate core fields
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

  // Validate all systems
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
    // Seed each system's magazine to its ready-service capacity (Repair MEDIUM-1): a
    // defensive opportunity does not create ammunition (§20 line 346), so the initial load
    // must be explicit and authoritative (§29.21).
    ammunitionByType: new Map<string, SafeInt>(
      systems.map((sys) => [sys.systemId, sys.magazineCapacity] as const),
    ),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
  };

  // Compute deterministic state hash
  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

// ---- addDisruptionRecord ----

export function addDisruptionRecord(
  state: AirDefenseState,
  severity: DisruptionSeverityType,
  bp: SafeInt,
  layer: LayerId,
): AirDefenseState {
  const disruptionRecord: DisruptionRecord = {
    severity,
    bp,
    timestampMs: SafeInt.ZERO, // Deterministic value set by caller
    layer,
  };

  const newDisruptionRecords = [...state.disruptionRecords, disruptionRecord];
  const newState: AirDefenseState = {
    ...state,
    disruptionRecords: newDisruptionRecords,
  };

  // Recompute hash after adding disruption
  newState.stateHash = computeAirDefenseStateHash(newState);
  return newState;
}

// ---- isValidDisruptionSeverity ----

export function isValidDisruptionSeverity(severity: string): severity is DisruptionSeverityType {
  return ["LIGHT", "MODERATE", "SEVERE", "MISSION_ABORT"].includes(severity);
}

// Re-export validateAirDefenseSystemDefinition from the system-definition module
// to avoid circular dependencies
import { validateAirDefenseSystemDefinition } from "./air-defense-system-definition.js";
