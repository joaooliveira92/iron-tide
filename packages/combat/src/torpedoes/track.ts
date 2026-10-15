//packages/combat/src/torpedoes/track.ts
// DESIGN-40 §13 TorpedoTrack (INC-4, part 1): every launched torpedo creates
// ONE authoritative track carrying ALL §13 fields. A torpedo remains an
// authoritative tactical entity until a terminal result is set (the shipped
// closed union HIT / DETONATION / DUD / GROUNDING / EXHAUSTION / DESTRUCTION /
// BATTLE_END); actual hit/detonation resolution is INC-5 — this slice ships
// the entity type, the deterministic id + hash, the guard, and the lifecycle
// state machine (advance + set-terminal) the engine threads across minutes in
// INC-7 (GunneryState idiom, engine.ts).
//
// Track id: derived deterministically from (battleId + launcherId + tubeId +
// launch minute + substep) — the contactKey/gunneryEventId stable-derivation
// idiom. Collision-free: within one battle a tube fires at most once per
// (launcher, minute, substep), so the tuple is unique.
//
// Track hash: SHA-256 domain-separated envelope (createEnvelope
// "torpedo-track" + torpedo_v1) over the authoritative non-hash surface —
// deepFreeze + envelope record pattern used across combat. Any authoritative
// field change changes the hash; the guard fails closed.
//
// Lifecycle state machine:
//   - createTorpedoTrack  -> terminalResult: null (running)
//   - advanceTorpedoTrack -> pure motion: integer µm displacement along the
//     launch heading (movement module's authored per-degree direction table,
//     folded from milli-degrees), distance/arming accounting, and the
//     deterministic EXHAUSTION transition when the run distance is consumed.
//     Advancing a terminal track is illegal (TORPEDO_STATE_INVARIANT_FAILED).
//   - setTorpedoTerminalResult -> validates the closed-union member and that
//     the track is still running; the transition is one-way (a terminal track
//     cannot be re-opened or re-terminalized).
//
// §13 guidance invariant: while the torpedo runs, its ordered course — the
// guidanceState.orderedGyroAngleMdeg carried on the run — MUST equal the launch
// heading it projects along (launchHeadingMdeg; a gyro-guided torpedo's ordered
// course is its launch heading). The run projects along launchHeadingMdeg only,
// so divergent fields would make the track internally inconsistent (an INC-5
// hit-resolution seam). assertTorpedoTrackSurface fails closed
// (TORPEDO_STATE_INVARIANT_FAILED) if the two ever diverge; the duplicate field
// can never drift from the projection source.
//
// All arithmetic is integer fixed-point; no floating point, I/O, clock, or
// ambient randomness.
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
import type { Position } from "../spotting/detection.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";

// §13 "reliability state": the per-roll reliability of the running torpedo,
// normalized from the model's §1 reliabilityBp (100_000 scale) to the
// 10_000 bp roll scale with floor(reliabilityBp / 10) — 1% = 100 bp, the §12
// launch-failure roll scale (constants.ts note). INC-5 consumes it for the
// detonation roll.
export interface TorpedoReliabilityState {
  reliabilityBp: number; // integer [0, 10_000] — normalized per-roll reliability
}

// §13 "guidance state": the torpedo's guidance capability (from the model) and
// the ordered gyro angle carried on the run.
export interface TorpedoGuidanceState {
  capabilityId: string; // the model's guidanceCapability ("gyro", "none", ...)
  orderedGyroAngleMdeg: number; // integer milli-degrees, full circle 360_000
}

// §13 "detection state by participant": per participant id (ship/contact) the
// detection status of THIS torpedo. Starts empty (no participant has detected
// the torpedo at launch); the detection model populates it (INC-7 seam).
export interface TorpedoDetectionState {
  detectedByParticipant: Record<string, { detected: boolean; confidenceBp: number }>;
}

export function emptyTorpedoDetectionState(): TorpedoDetectionState {
  return { detectedByParticipant: {} };
}

// §13 authoritative TorpedoTrack. terminalResult null while the torpedo is a
// running authoritative entity; INC-5+ set it through the lifecycle machine.
export interface TorpedoTrack {
  torpedoTrackId: string;
  battleId: string;
  launcherId: string;
  firingShipId: string;
  firingSideId: string;
  tubeId: number; // the tube that fired (part of the id derivation)
  targetContactId: string; // contact id, or the §13 NO_TARGET_CONTACT marker for area fire
  torpedoModelId: string;
  selectedSettingId: string; // the salvo's selected §1 speed/range setting
  launchMinute: number;
  launchSubstep: number;
  launchPosition: Position; // integer micrometres
  launchHeadingMdeg: number; // integer milli-degrees, full circle 360_000
  orderedGyroAngleMdeg: number; // integer milli-degrees
  speedKnotsBp: number; // integer basis-point knots (setting)
  maxRunDistanceM: number; // integer metres (setting)
  armingDistanceM: number; // integer metres (model minimum arming distance)
  depthSettingM: number; // integer metres
  reliabilityState: TorpedoReliabilityState;
  guidanceState: TorpedoGuidanceState;
  detectionState: TorpedoDetectionState;
  currentPosition: Position; // integer micrometres
  // Authoritative advance accounting (the INC-5/INC-7 seam): integer µm
  // accumulated along the run, the remaining run distance in metres (metre
  // quantum), and whether the arming distance has been traveled (§14).
  distanceTraveledUm: number;
  runDistanceRemainingM: number;
  armed: boolean;
  terminalResult: TorpedoTerminalResult | null; // null while running
  trackHash: string; // authoritative deterministic hash
}

// AC-13: deterministic track id — mirror of contactKey/gunneryEventId.
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

// Full-circle milli-degree fold: any integer -> [0, 360_000).
export function foldMdeg(mdeg: number): number {
  return (((mdeg % 360_000) + 360_000) % 360_000) | 0;
}

// AC-13: surface guard — every §13 field well-formed; a malformed track fails
// closed with TORPEDO_STATE_INVARIANT_FAILED (EXCEPT the trackHash presence, a
// hash-less surface is validated before hashing). Reversible-to-invariant.
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
    // §13 area-fire marker — valid.
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
  // §13 guidance invariant: while the torpedo runs its ordered gyro angle must
  // equal the launch heading (the run projects along launchHeadingMdeg only) —
  // fail closed rather than carry an internally inconsistent track.
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

// AC-13: full guard incl. the trackHash presence requirement.
export function assertAuthoritativeTorpedoTrack(t: TorpedoTrack): void {
  assertTorpedoTrackSurface(t);
  if (!isNonEmptyString(t.trackHash))
    invariant(t, "trackHash", t.trackHash, "trackHash must be a non-empty string");
}

// Authoritative track hash: domain-separated envelope over the non-hash
// surface. Any authoritative field change changes the hash (tamper-proof).
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

// AC-13: build the authoritative track with its hash. The launch position and
// current position are the same at launch; the track is running (terminalResult
// null) until INC-5+ resolves it.
export function createTorpedoTrack(o: {
  battleId: string;
  launcherId: string;
  firingShipId: string;
  firingSideId: string;
  tubeId: number;
  targetContactId: string | null; // null -> the §13 NONE marker (area fire)
  torpedoModelId: string;
  reliabilityBp: number; // the model's §1 reliabilityBp (100_000 scale)
  guidanceCapability: string; // the model's guidance capability id
  selectedSetting: CompiledTorpedoSpeedSetting; // the salvo's selected speed/range setting
  armingDistanceM: number; // the model's minimum arming distance
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
      reliabilityBp: Math.floor(o.reliabilityBp / 10), // normalized to the 10_000 bp roll scale
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

// Fail-closed hash verification: recompute and compare. Any tampered field
// produces a mismatch (never silently accepted).
export function verifyTorpedoTrackHash(t: TorpedoTrack): boolean {
  return computeTorpedoTrackHash(t) === t.trackHash;
}

// Project an integer µm displacement along an integer milli-degree heading:
// fold to the nearest-lower integer degree and reuse the movement module's
// authored per-degree direction table (single source of truth; the cos/sin
// components are on the module's DIRECTION_FIXED 10_000 scale). Explicit FLOOR
// rounding on both components (the torpedo module's arithmetic convention).
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

// AC-13: pure minute-advance of a RUNNING track — integer µm displacement
// along the launch heading, distance/arming accounting, and the deterministic
// EXHAUSTION transition when the run distance is consumed. Advancing a
// terminal track is illegal (the torpedo is no longer an advancing entity).
// The engine (INC-7) threads tracks across minutes with this function
// (GunneryState idiom).
export function advanceTorpedoTrack(t: TorpedoTrack, dtMs: number): TorpedoTrack {
  assertAuthoritativeTorpedoTrack(t);
  if (!Number.isInteger(dtMs) || dtMs <= 0)
    invariant(t, "dtMs", dtMs, "advance dt must be a positive integer milliseconds");
  if (t.terminalResult !== null)
    invariant(t, "terminalResult", t.terminalResult, "a terminal torpedo track cannot be advanced");

  const speedUmS = torpedoSpeedBpKnotsToUmS(t.speedKnotsBp);
  // distanceUm = speed (µm/s) * dtMs / 1_000 — exact integer division (the
  // torpedo speed scale makes the product exact for the shipped minute quantum).
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

// AC-13: one-way lifecycle transition — set the closed-union terminal result on
// a RUNNING track. A terminal track cannot be re-opened or re-terminalized
// (TORPEDO_STATE_INVARIANT_FAILED); a non-canonical result fails closed. INC-5
// (hit/detonation/dud), the engine (battle end), and the hazard resolvers
// (grounding/destruction) call this.
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
