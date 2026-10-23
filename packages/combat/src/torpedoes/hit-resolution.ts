import { BluewaveError } from "@bluewave/contracts";
import type { ContactTrack } from "../contact/neighbour.js";
import type { Position } from "../core/position.js";
import { NO_TARGET_CONTACT } from "./constants.js";
import { TORPEDO_HIT_RESOLVED, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import { assertAuthoritativeTorpedoTrack, type TorpedoTrack } from "./track.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function isPosition(v: unknown): v is Position {
  return Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);
}

export const TORPEDO_CONTACT_BLOCKERS = [
  "TARGET_AVOIDANCE",
  "TARGET_DECOY",
  "TARGET_INTERCEPTION",
  "TORPEDO_FAILURE",
] as const;
export type TorpedoContactBlocker = (typeof TORPEDO_CONTACT_BLOCKERS)[number];

export interface TargetHitProfile {
  targetId: string;
  contactId: string;
  collisionRadiusM: number;
  draftM: number;
  terminalStatus: string | null;
}

export function assertTargetHitProfile(p: TargetHitProfile): void {
  if (typeof p !== "object" || p === null)
    invariant("targetHitProfile", p, "a target hit profile is required");
  if (typeof p.targetId !== "string" || p.targetId.length === 0)
    invariant("targetId", p.targetId, "targetId must be a non-empty string");
  if (typeof p.contactId !== "string" || p.contactId.length === 0)
    invariant("contactId", p.contactId, "contactId must be a non-empty string");
  if (!isInt(p.collisionRadiusM) || p.collisionRadiusM < 1)
    invariant(
      "collisionRadiusM",
      p.collisionRadiusM,
      "collision radius must be an integer metre >= 1",
    );
  if (!isInt(p.draftM) || p.draftM < 0)
    invariant("draftM", p.draftM, "draft must be an integer metre >= 0");
  if (p.terminalStatus !== null && typeof p.terminalStatus !== "string")
    invariant("terminalStatus", p.terminalStatus, "terminal status must be a string or null");
}

export function intersectsCollisionGeometry(
  trackPosition: Position,
  centre: Position,
  collisionRadiusM: number,
): boolean {
  if (!isPosition(trackPosition))
    invariant("trackPosition", trackPosition, "track position must be an integer µm pair");
  if (!isPosition(centre)) invariant("centre", centre, "centre must be an integer µm pair");
  if (!isInt(collisionRadiusM) || collisionRadiusM < 1)
    invariant(
      "collisionRadiusM",
      collisionRadiusM,
      "collision radius must be an integer metre >= 1",
    );
  const dxUm = BigInt(trackPosition[0]) - BigInt(centre[0]);
  const dyUm = BigInt(trackPosition[1]) - BigInt(centre[1]);
  const radiusUm = BigInt(collisionRadiusM) * 1_000_000n;
  return dxUm * dxUm + dyUm * dyUm <= radiusUm * radiusUm;
}

export function sweptPathIntersectsCollisionGeometry(
  from: Position,
  to: Position,
  centre: Position,
  collisionRadiusM: number,
): boolean {
  if (!isPosition(from)) invariant("sweptFrom", from, "swept start must be an integer µm pair");
  if (intersectsCollisionGeometry(to, centre, collisionRadiusM)) return true;
  const ax = BigInt(from[0]);
  const ay = BigInt(from[1]);
  const dx = BigInt(to[0]) - ax;
  const dy = BigInt(to[1]) - ay;
  const px = BigInt(centre[0]) - ax;
  const py = BigInt(centre[1]) - ay;
  const len2 = dx * dx + dy * dy;
  const radiusUm = BigInt(collisionRadiusM) * 1_000_000n;
  if (len2 === 0n) return px * px + py * py <= radiusUm * radiusUm;
  const dot = px * dx + py * dy;
  if (dot <= 0n) return px * px + py * py <= radiusUm * radiusUm;
  if (dot >= len2) return false;
  return (px * px + py * py) * len2 - dot * dot <= radiusUm * radiusUm * len2;
}

export function traveledArmingDistance(track: TorpedoTrack): boolean {
  return Math.floor(track.distanceTraveledUm / 1_000_000) >= track.armingDistanceM;
}

export function depthDraftCompatible(depthSettingM: number, draftM: number): boolean {
  if (!isInt(depthSettingM) || depthSettingM < 0)
    invariant("depthSettingM", depthSettingM, "depth setting must be an integer metre >= 0");
  if (!isInt(draftM) || draftM < 0)
    invariant("draftM", draftM, "draft must be an integer metre >= 0");
  return depthSettingM <= draftM;
}

export function contactBlockersClear(blocker: TorpedoContactBlocker | null): boolean {
  if (blocker !== null && !(TORPEDO_CONTACT_BLOCKERS as readonly string[]).includes(blocker))
    invariant("blocker", blocker, "blocker must be a canonical §14 blocker or null");
  return blocker === null;
}

export function isLegalTarget(o: {
  contactId: string;
  knownTracks: Map<string, ContactTrack> | readonly ContactTrack[];
  terminalStatus: string | null;
}): boolean {
  let map: Map<string, ContactTrack>;
  if (o.knownTracks instanceof Map) {
    map = o.knownTracks;
  } else {
    map = new Map(o.knownTracks.map((c) => [c.contactId, c]));
  }
  const contact = map.get(o.contactId);
  if (!contact) return false;
  if (!Number.isInteger(contact.confidence) || contact.confidence <= 0) return false;
  if (o.terminalStatus === "FOUNDERED") return false;
  return true;
}

export function legalContactPosition(
  knownTracks: Map<string, ContactTrack> | readonly ContactTrack[],
  contactId: string,
): Position | null {
  let map: Map<string, ContactTrack>;
  if (knownTracks instanceof Map) {
    map = knownTracks;
  } else {
    map = new Map(knownTracks.map((c) => [c.contactId, c]));
  }
  const contact = map.get(contactId);
  if (!contact) return null;
  return [contact.position[0], contact.position[1]];
}

export function impactOrderingValid(o: {
  launchMinute: number;
  launchSubstep: number;
  impactMinute: number;
  impactSubstep: number;
}): boolean {
  if (!isInt(o.launchMinute) || o.launchMinute < 0)
    invariant("launchMinute", o.launchMinute, "launch minute must be a non-negative integer");
  if (!isInt(o.launchSubstep) || o.launchSubstep < 1)
    invariant("launchSubstep", o.launchSubstep, "launch substep must be a positive integer");
  if (!isInt(o.impactMinute) || o.impactMinute < 0)
    invariant("impactMinute", o.impactMinute, "impact minute must be a non-negative integer");
  if (!isInt(o.impactSubstep) || o.impactSubstep < 1)
    invariant("impactSubstep", o.impactSubstep, "impact substep must be a positive integer");
  return (
    o.impactMinute > o.launchMinute ||
    (o.impactMinute === o.launchMinute && o.impactSubstep > o.launchSubstep)
  );
}

export type TorpedoHitOutcome = "HIT" | "MISS";
export type TorpedoHitRejection =
  | "NOT_ARMED"
  | "GEOMETRY_MISS"
  | "DEPTH_INCOMPATIBLE"
  | "TARGET_AVOIDED"
  | "TARGET_DECOYED"
  | "TARGET_INTERCEPTED"
  | "TORPEDO_FAILURE"
  | "NO_LEGAL_TARGET"
  | "TARGET_NOT_PHYSICAL"
  | "INVALID_IMPACT_ORDER";

export interface TorpedoHitPredicates {
  blockersClear: boolean;
  orderingValid: boolean;
  targetLegal: boolean;
  geometryIntersects: boolean;
  depthCompatible: boolean;
  traveledArmingDistance: boolean;
}

export interface TorpedoHitResolution {
  hit: boolean;
  outcome: TorpedoHitOutcome;
  rejection: TorpedoHitRejection | null;
  reasonCode: string | null;
  predicates: TorpedoHitPredicates;
  trackId: string;
  targetContactId: string;
  launchMinute: number;
  launchSubstep: number;
  impactMinute: number;
  impactSubstep: number;
  collisionCentre: Position | null;
  collisionRadiusM: number | null;
  draftM: number | null;
}

export function resolveTorpedoHit(o: {
  track: TorpedoTrack;
  target: TargetHitProfile | null;
  knownTracks: Map<string, ContactTrack> | ContactTrack[];
  blocker: TorpedoContactBlocker | null;
  impactMinute: number;
  impactSubstep: number;
  sweptFrom?: Position;
}): TorpedoHitResolution {
  assertAuthoritativeTorpedoTrack(o.track);
  if (o.track.terminalResult !== null)
    invariant(
      "track",
      o.track.torpedoTrackId,
      "hit resolution requires a RUNNING track (a terminal track already left the contact geometry)",
    );
  if (!isInt(o.impactMinute))
    invariant("impactMinute", o.impactMinute, "impact minute must be an integer");
  if (!isInt(o.impactSubstep) || o.impactSubstep < 1)
    invariant("impactSubstep", o.impactSubstep, "impact substep must be a positive integer");
  if (o.target !== null) assertTargetHitProfile(o.target);

  const blockersClear = contactBlockersClear(o.blocker);
  const orderingValid = impactOrderingValid({
    launchMinute: o.track.launchMinute,
    launchSubstep: o.track.launchSubstep,
    impactMinute: o.impactMinute,
    impactSubstep: o.impactSubstep,
  });

  const hasTarget = o.target !== null && o.track.targetContactId !== NO_TARGET_CONTACT;
  const targetLegal = hasTarget
    ? isLegalTarget({
        contactId: o.target!.contactId,
        knownTracks: o.knownTracks,
        terminalStatus: o.target!.terminalStatus,
      })
    : false;

  let geometryIntersects = false;
  if (targetLegal && o.target !== null) {
    const centre = legalContactPosition(o.knownTracks, o.target.contactId);
    geometryIntersects =
      centre !== null &&
      (o.sweptFrom !== undefined
        ? sweptPathIntersectsCollisionGeometry(
            o.sweptFrom,
            o.track.currentPosition,
            centre,
            o.target.collisionRadiusM,
          )
        : intersectsCollisionGeometry(o.track.currentPosition, centre, o.target.collisionRadiusM));
  }
  const depthCompatible =
    o.target !== null && depthDraftCompatible(o.track.depthSettingM, o.target.draftM);
  const traveledArming = traveledArmingDistance(o.track);

  const predicates: TorpedoHitPredicates = {
    blockersClear,
    orderingValid,
    targetLegal,
    geometryIntersects,
    depthCompatible,
    traveledArmingDistance: traveledArming,
  };

  let rejection: TorpedoHitRejection | null = null;
  if (!predicates.blockersClear) {
    rejection =
      o.blocker === "TARGET_AVOIDANCE"
        ? "TARGET_AVOIDED"
        : o.blocker === "TARGET_DECOY"
          ? "TARGET_DECOYED"
          : o.blocker === "TARGET_INTERCEPTION"
            ? "TARGET_INTERCEPTED"
            : "TORPEDO_FAILURE";
  } else if (!predicates.orderingValid) {
    rejection = "INVALID_IMPACT_ORDER";
  } else if (!predicates.targetLegal) {
    rejection = !hasTarget
      ? "NO_LEGAL_TARGET"
      : o.target!.terminalStatus === "FOUNDERED"
        ? "TARGET_NOT_PHYSICAL"
        : "NO_LEGAL_TARGET";
  } else if (!predicates.geometryIntersects) {
    rejection = "GEOMETRY_MISS";
  } else if (!predicates.depthCompatible) {
    rejection = "DEPTH_INCOMPATIBLE";
  } else if (!predicates.traveledArmingDistance) {
    rejection = "NOT_ARMED";
  }

  const hit = rejection === null;
  return Object.freeze({
    hit,
    outcome: hit ? ("HIT" as const) : ("MISS" as const),
    rejection,
    reasonCode: hit ? TORPEDO_HIT_RESOLVED : null,
    predicates,
    trackId: o.track.torpedoTrackId,
    targetContactId: o.track.targetContactId,
    launchMinute: o.track.launchMinute,
    launchSubstep: o.track.launchSubstep,
    impactMinute: o.impactMinute,
    impactSubstep: o.impactSubstep,
    collisionCentre:
      hit && o.target !== null ? legalContactPosition(o.knownTracks, o.target.contactId) : null,
    collisionRadiusM: o.target !== null ? o.target.collisionRadiusM : null,
    draftM: o.target !== null ? o.target.draftM : null,
  });
}
