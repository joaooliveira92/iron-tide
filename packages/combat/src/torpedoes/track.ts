import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { DIRECTION_FIXED } from "../movement/constants.js";
import { directionBp } from "../movement/kinematics.js";
import {
  NO_TARGET_CONTACT,
  TORPEDO_TERMINAL_RESULTS,
  TORPEDO_TRACK_MDEG_PER_DEGREE,
  torpedoPolicyId,
  torpedoSpeedBpKnotsToUmS,
  type TorpedoTerminalResult,
} from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import type { Position } from "../core/position.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";

export interface TorpedoReliabilityState {
  reliabilityBp: number;
}

export interface TorpedoGuidanceState {
  capabilityId: string;
  orderedGyroAngleMdeg: number;
}

export interface TorpedoDetectionState {
  detectedByParticipant: Record<string, { detected: boolean; confidenceBp: number }>;
}

export function emptyTorpedoDetectionState(): TorpedoDetectionState {
  return { detectedByParticipant: {} };
}

export interface TorpedoTrack {
  torpedoTrackId: string;
  battleId: string;
  launcherId: string;
  firingShipId: string;
  firingSideId: string;
  tubeId: number;
  targetContactId: string;
  torpedoModelId: string;
  selectedSettingId: string;
  launchMinute: number;
  launchSubstep: number;
  launchPosition: Position;
  launchHeadingMdeg: number;
  orderedGyroAngleMdeg: number;
  speedKnotsBp: number;
  maxRunDistanceM: number;
  armingDistanceM: number;
  depthSettingM: number;
  reliabilityState: TorpedoReliabilityState;
  guidanceState: TorpedoGuidanceState;
  detectionState: TorpedoDetectionState;
  currentPosition: Position;
  distanceTraveledUm: number;
  runDistanceRemainingM: number;
  armed: boolean;
  terminalResult: TorpedoTerminalResult | null;
  trackHash: string;
}

export function torpedoTrackId(o: {
  battleId: string;
  launcherId: string;
  tubeId: number;
  launchMinute: number;
  launchSubstep: number;
}): string {
  return `${o.battleId}:${o.launchMinute}:${o.launchSubstep}:torpedo:${o.launcherId}:tube${o.tubeId}`;
}

function invariantField(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function invariant(t: TorpedoTrack, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function isPosition(v: unknown): v is Position {
  return Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);
}

export function foldMdeg(mdeg: number): number {
  return (((mdeg % 360_000) + 360_000) % 360_000) | 0;
}

export function assertTorpedoTrackSurface(t: TorpedoTrack): void {
  if (!isNonEmptyString(t.torpedoTrackId))
    invariant(t, "torpedoTrackId", t.torpedoTrackId, "torpedoTrackId must be a non-empty string");
  if (!isNonEmptyString(t.battleId))
    invariant(t, "battleId", t.battleId, "battleId must be a non-empty string");
  if (!isNonEmptyString(t.launcherId))
    invariant(t, "launcherId", t.launcherId, "launcherId must be a non-empty string");
  if (!isNonEmptyString(t.firingShipId))
    invariant(t, "firingShipId", t.firingShipId, "firingShipId must be a non-empty string");
  if (!isNonEmptyString(t.firingSideId))
    invariant(t, "firingSideId", t.firingSideId, "firingSideId must be a non-empty string");
  if (!isInt(t.tubeId) || t.tubeId < 0)
    invariant(t, "tubeId", t.tubeId, "tubeId must be a non-negative integer");
  if (t.targetContactId === NO_TARGET_CONTACT) {
  } else if (!isNonEmptyString(t.targetContactId)) {
    invariant(
      t,
      "targetContactId",
      t.targetContactId,
      "target contact must be a contact id or the §13 NONE marker for area fire",
    );
  }
  if (!isNonEmptyString(t.torpedoModelId))
    invariant(t, "torpedoModelId", t.torpedoModelId, "torpedoModelId must be a non-empty string");
  if (!isNonEmptyString(t.selectedSettingId))
    invariant(
      t,
      "selectedSettingId",
      t.selectedSettingId,
      "selectedSettingId must be a non-empty string",
    );
  if (!isInt(t.launchMinute) || t.launchMinute < 0)
    invariant(t, "launchMinute", t.launchMinute, "launch minute must be a non-negative integer");
  if (!isInt(t.launchSubstep) || t.launchSubstep < 1)
    invariant(t, "launchSubstep", t.launchSubstep, "launch substep must be a positive integer");
  if (!isPosition(t.launchPosition))
    invariant(t, "launchPosition", t.launchPosition, "launch position must be an integer µm pair");
  if (!isInt(t.launchHeadingMdeg))
    invariant(
      t,
      "launchHeadingMdeg",
      t.launchHeadingMdeg,
      "launch heading must be an integer milli-degrees",
    );
  if (!isInt(t.orderedGyroAngleMdeg))
    invariant(
      t,
      "orderedGyroAngleMdeg",
      t.orderedGyroAngleMdeg,
      "gyro angle must be integer milli-degrees",
    );
  if (t.orderedGyroAngleMdeg !== t.launchHeadingMdeg)
    invariant(
      t,
      "orderedGyroAngleMdeg",
      t.orderedGyroAngleMdeg,
      "a gyro-guided torpedo's ordered course must equal its launch heading while running",
    );
  if (!isInt(t.speedKnotsBp) || t.speedKnotsBp <= 0)
    invariant(
      t,
      "speedKnotsBp",
      t.speedKnotsBp,
      "speed must be a positive integer basis-point knots",
    );
  if (!isInt(t.maxRunDistanceM) || t.maxRunDistanceM <= 0)
    invariant(
      t,
      "maxRunDistanceM",
      t.maxRunDistanceM,
      "max run distance must be a positive integer metres",
    );
  if (!isInt(t.armingDistanceM) || t.armingDistanceM < 0)
    invariant(
      t,
      "armingDistanceM",
      t.armingDistanceM,
      "arming distance must be a non-negative integer metres",
    );
  if (!isInt(t.depthSettingM) || t.depthSettingM < 0)
    invariant(
      t,
      "depthSettingM",
      t.depthSettingM,
      "depth setting must be a non-negative integer metres",
    );
  const rel = t.reliabilityState;
  if (
    typeof rel !== "object" ||
    rel === null ||
    !isInt(rel.reliabilityBp) ||
    rel.reliabilityBp < 0 ||
    rel.reliabilityBp > 10_000
  )
    invariant(
      t,
      "reliabilityState",
      rel,
      "reliability state must carry a normalized integer [0, 10_000] bp",
    );
  const g = t.guidanceState;
  if (
    typeof g !== "object" ||
    g === null ||
    !isNonEmptyString(g.capabilityId) ||
    !isInt(g.orderedGyroAngleMdeg)
  )
    invariant(
      t,
      "guidanceState",
      g,
      "guidance state must carry a capability id and integer gyro angle",
    );
  const d = t.detectionState;
  if (
    typeof d !== "object" ||
    d === null ||
    typeof d.detectedByParticipant !== "object" ||
    d.detectedByParticipant === null
  )
    invariant(t, "detectionState", d, "detection state must be a record keyed by participant id");
  for (const [participantId, status] of Object.entries(d.detectedByParticipant)) {
    if (participantId.length === 0)
      invariant(t, "detectionState", d, "participant ids must be non-empty");
    if (typeof status !== "object" || status === null || typeof status.detected !== "boolean")
      invariant(t, "detectionState", d, "each participant status must carry a detected boolean");
    if (!isInt(status.confidenceBp) || status.confidenceBp < 0 || status.confidenceBp > 10_000)
      invariant(t, "detectionState", d, "detection confidence must be integer bp [0, 10_000]");
  }
  if (!isPosition(t.currentPosition))
    invariant(
      t,
      "currentPosition",
      t.currentPosition,
      "current position must be an integer µm pair",
    );
  if (!isInt(t.distanceTraveledUm) || t.distanceTraveledUm < 0)
    invariant(
      t,
      "distanceTraveledUm",
      t.distanceTraveledUm,
      "distance traveled must be a non-negative integer µm",
    );
  if (!isInt(t.runDistanceRemainingM) || t.runDistanceRemainingM < 0)
    invariant(
      t,
      "runDistanceRemainingM",
      t.runDistanceRemainingM,
      "remaining run distance must be a non-negative integer metres",
    );
  if (typeof t.armed !== "boolean") invariant(t, "armed", t.armed, "armed must be a boolean");
  if (
    t.terminalResult !== null &&
    !(TORPEDO_TERMINAL_RESULTS as readonly string[]).includes(t.terminalResult)
  )
    invariant(
      t,
      "terminalResult",
      t.terminalResult,
      "terminal result must be a canonical §13 outcome or null",
    );
}

export function assertAuthoritativeTorpedoTrack(t: TorpedoTrack): void {
  assertTorpedoTrackSurface(t);
  if (!isNonEmptyString(t.trackHash))
    invariant(t, "trackHash", t.trackHash, "trackHash must be a non-empty string");
}

export function computeTorpedoTrackHash(t: TorpedoTrack): string {
  const surface = {
    torpedoTrackId: t.torpedoTrackId,
    battleId: t.battleId,
    launcherId: t.launcherId,
    firingShipId: t.firingShipId,
    firingSideId: t.firingSideId,
    tubeId: t.tubeId,
    targetContactId: t.targetContactId,
    torpedoModelId: t.torpedoModelId,
    selectedSettingId: t.selectedSettingId,
    launchMinute: t.launchMinute,
    launchSubstep: t.launchSubstep,
    launchPosition: t.launchPosition,
    launchHeadingMdeg: t.launchHeadingMdeg,
    orderedGyroAngleMdeg: t.orderedGyroAngleMdeg,
    speedKnotsBp: t.speedKnotsBp,
    maxRunDistanceM: t.maxRunDistanceM,
    armingDistanceM: t.armingDistanceM,
    depthSettingM: t.depthSettingM,
    reliabilityState: t.reliabilityState,
    guidanceState: t.guidanceState,
    detectionState: t.detectionState,
    currentPosition: t.currentPosition,
    distanceTraveledUm: t.distanceTraveledUm,
    runDistanceRemainingM: t.runDistanceRemainingM,
    armed: t.armed,
    terminalResult: t.terminalResult,
  };
  return createEnvelope("torpedo-track", torpedoPolicyId, surface).bodyHash;
}

export function createTorpedoTrack(o: {
  battleId: string;
  launcherId: string;
  firingShipId: string;
  firingSideId: string;
  tubeId: number;
  targetContactId: string | null;
  torpedoModelId: string;
  reliabilityBp: number;
  guidanceCapability: string;
  selectedSetting: CompiledTorpedoSpeedSetting;
  armingDistanceM: number;
  launchMinute: number;
  launchSubstep: number;
  launchPosition: Position;
  launchHeadingMdeg: number;
  orderedGyroAngleMdeg: number;
  depthSettingM: number;
}): TorpedoTrack {
  const launchPosition: Position = [o.launchPosition[0], o.launchPosition[1]];
  const track: TorpedoTrack = {
    torpedoTrackId: torpedoTrackId({
      battleId: o.battleId,
      launcherId: o.launcherId,
      tubeId: o.tubeId,
      launchMinute: o.launchMinute,
      launchSubstep: o.launchSubstep,
    }),
    battleId: o.battleId,
    launcherId: o.launcherId,
    firingShipId: o.firingShipId,
    firingSideId: o.firingSideId,
    tubeId: o.tubeId,
    targetContactId: o.targetContactId ?? NO_TARGET_CONTACT,
    torpedoModelId: o.torpedoModelId,
    selectedSettingId: o.selectedSetting.settingId,
    launchMinute: o.launchMinute,
    launchSubstep: o.launchSubstep,
    launchPosition,
    launchHeadingMdeg: o.launchHeadingMdeg,
    orderedGyroAngleMdeg: o.orderedGyroAngleMdeg,
    speedKnotsBp: o.selectedSetting.speedMilliKnots,
    maxRunDistanceM: o.selectedSetting.rangeM,
    armingDistanceM: o.armingDistanceM,
    depthSettingM: o.depthSettingM,
    reliabilityState: {
      reliabilityBp: Math.floor(o.reliabilityBp / 10),
    },
    guidanceState: {
      capabilityId: o.guidanceCapability,
      orderedGyroAngleMdeg: o.orderedGyroAngleMdeg,
    },
    detectionState: emptyTorpedoDetectionState(),
    currentPosition: launchPosition,
    distanceTraveledUm: 0,
    runDistanceRemainingM: o.selectedSetting.rangeM,
    armed: false,
    terminalResult: null,
    trackHash: "",
  };
  const hash = computeTorpedoTrackHash(track);
  const full: TorpedoTrack = { ...track, trackHash: hash };
  assertAuthoritativeTorpedoTrack(full);
  return Object.freeze(full);
}

export function verifyTorpedoTrackHash(t: TorpedoTrack): boolean {
  return computeTorpedoTrackHash(t) === t.trackHash;
}

export function projectAlongHeading(
  origin: Position,
  headingMdeg: number,
  distanceUm: number,
): Position {
  if (!Number.isInteger(distanceUm) || distanceUm < 0)
    invariantField("distanceUm", distanceUm, "displacement must be a non-negative integer µm");
  const degree = Math.floor(foldMdeg(headingMdeg) / TORPEDO_TRACK_MDEG_PER_DEGREE);
  const { cosBp, sinBp } = directionBp(degree);
  const dX = Math.floor((distanceUm * cosBp) / DIRECTION_FIXED);
  const dY = Math.floor((distanceUm * sinBp) / DIRECTION_FIXED);
  return [origin[0] + dX, origin[1] + dY];
}

export function advanceTorpedoTrack(t: TorpedoTrack, dtMs: number): TorpedoTrack {
  assertAuthoritativeTorpedoTrack(t);
  if (!Number.isInteger(dtMs) || dtMs <= 0)
    invariant(t, "dtMs", dtMs, "advance dt must be a positive integer milliseconds");
  if (t.terminalResult !== null)
    invariant(t, "terminalResult", t.terminalResult, "a terminal torpedo track cannot be advanced");

  const speedUmS = torpedoSpeedBpKnotsToUmS(t.speedKnotsBp);
  const distanceUm = Math.floor((speedUmS * dtMs) / 1_000);
  const currentPosition = projectAlongHeading(t.currentPosition, t.launchHeadingMdeg, distanceUm);
  const distanceTraveledUm = t.distanceTraveledUm + distanceUm;
  const distanceTraveledM = Math.floor(distanceTraveledUm / 1_000_000);
  const exhausted = distanceTraveledM >= t.maxRunDistanceM;
  const advanced: TorpedoTrack = {
    ...t,
    currentPosition,
    distanceTraveledUm,
    runDistanceRemainingM: exhausted ? 0 : Math.max(0, t.maxRunDistanceM - distanceTraveledM),
    armed: distanceTraveledM >= t.armingDistanceM,
    terminalResult: exhausted ? "EXHAUSTION" : null,
    trackHash: "",
  };
  const hash = computeTorpedoTrackHash(advanced);
  const full: TorpedoTrack = { ...advanced, trackHash: hash };
  assertAuthoritativeTorpedoTrack(full);
  return Object.freeze(full);
}

export function setTorpedoTerminalResult(
  t: TorpedoTrack,
  terminalResult: TorpedoTerminalResult,
): TorpedoTrack {
  assertAuthoritativeTorpedoTrack(t);
  if (t.terminalResult !== null)
    invariant(
      t,
      "terminalResult",
      t.terminalResult,
      "a terminal torpedo track cannot transition again",
    );
  if (!(TORPEDO_TERMINAL_RESULTS as readonly string[]).includes(terminalResult))
    invariant(
      t,
      "terminalResult",
      terminalResult,
      "terminal result must be a canonical §13 outcome",
    );
  const terminal: TorpedoTrack = { ...t, terminalResult, trackHash: "" };
  const hash = computeTorpedoTrackHash(terminal);
  const full: TorpedoTrack = { ...terminal, trackHash: hash };
  assertAuthoritativeTorpedoTrack(full);
  return Object.freeze(full);
}
