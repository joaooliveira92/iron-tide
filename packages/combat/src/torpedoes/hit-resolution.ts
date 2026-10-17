// DESIGN-40 §14 hit resolution (INC-5, AC-13 part 2): a torpedo HIT requires
// ALL of the §14 predicates — (1) the track intersects the target's
// authoritative collision geometry, (2) the torpedo has traveled at least its
// arming distance, (3) the depth setting and the target draft are compatible,
// (4) no explicit avoidance / decoy / interception / failure result prevents
// contact, (5) the target remains a legal physical object, and (6) the impact
// (minute, substep) ordering is valid. On success the resolution records the
// in-slice reason code TORPEDO_HIT_RESOLVED; on failure it records the exact
// rejected predicate. Contact NEVER guarantees detonation — the §15 detonation
// resolver (detonation.ts) is a separate stage fed by this hit resolution.
//
// Authoritative collision geometry: there is NO production geometry in the
// codebase (research note — the track/contact carries position only), so the
// caller supplies the target's deterministic closed shape as a TargetHitProfile
// (integer collision radius + draft, fail-closed validated) AND the resolver
// anchors that shape at the LEGAL CONTACT's position (the firing side's
// knowledge estimate — hidden true state is never consulted; §9 anti-
// clairvoyance). The hit test is the exact integer circle test in micrometres.
//
// Arithmetic: all integer fixed-point. The circle test needs bigint because the
// squared micrometre offset on a large map reaches ~10^24 (a 1000 km offset is
// dx ~ 10^12 µm -> dx² ~ 10^24 > Number.MAX_SAFE_INTEGER ~ 9.0e15). Bound
// analysis (ENGINEERING-CONTRACT "introduce bigint only after documented bound
// analysis proves it necessary"): the ONLY bigint use is the boolean circle
// comparison; no bigint leaves the function.
//
// Target legality: the resolver MIRRORS the reused validateTargetOrder fog-gate
// rule set (a contact must exist in the firing side's known tracks with
// confidence > 0), returning a MISS rather than throwing. Unlike the launch
// gate, it never raises TACTICAL_FOG_OF_WAR_VIOLATION on the hit path: a running
// torpedo whose target contact decayed is a §14-condition failure (a miss), not
// an engine crash. A structurally malformed TargetHitProfile (caller bug) still
// fails closed with TORPEDO_STATE_INVARIANT_FAILED.
//
// Determinism: hit resolution is fully deterministic (geometric / time /
// legality predicates only; NO randomness — §14 ships no probability draw).
// Identical inputs -> identical verdict; results are frozen.
//
// AUTH SHIPPED CONCEPTS (INC-5 decisions, recorded for ADR-0029):
// - collision shape: a circle of integer collisionRadiusM centred on the legal
//   contact position (inclusive boundary: an exact-radius pass IS a contact).
// - arming predicate: traveledArmingDistance mirrors the §13 track.armed flag
//   (floor-metre traveled vs armingDistanceM).
// - depth/draft: depthSettingM must lie within [0 m waterline .. draftM];
//   below the draft the torpedo passes under the hull (depth-axis miss).
// - physical-object legality: a FOUNDERED ship is no longer a contactable
//   physical object; a SINKING ship still is (its hull remains in the water).
// - impact ordering: impact (minute, substep) strictly AFTER launch.
import { BluewaveError } from "@bluewave/contracts";
import type { ContactTrack } from "../targeting.js";
import type { Position } from "../spotting/detection.js";
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

// ---- §14(4) explicit non-contact results --------------------------------------
// "no explicit avoidance, decoy, interception, or failure result prevents
// contact": the deferred evasion / decoy / interception / countermeasure
// mechanics (§25 + countermeasure tracks) WRITE these flags; the resolver only
// consumes them. A non-null blocker deterministically prevents contact (it is
// an explicit prior resolution result, not a probability this resolver rolls).
export const TORPEDO_CONTACT_BLOCKERS = [
  "TARGET_AVOIDANCE", // the target evaded (authoritative maneuver result)
  "TARGET_DECOY", // the torpedo was decoyed (decoy/countermeasure result)
  "TARGET_INTERCEPTION", // the torpedo was intercepted/attrited en route
  "TORPEDO_FAILURE", // an explicit in-flight mechanical failure result
] as const;
export type TorpedoContactBlocker = (typeof TORPEDO_CONTACT_BLOCKERS)[number];

// ---- TargetHitProfile (caller-supplied authoritative collision geometry) ------
// The phase/entity layer supplies this per target (no production geometry in
// the engine). All fields integer; fail-closed validated by
// assertTargetHitProfile (TORPEDO_STATE_INVARIANT_FAILED on malformed input).
export interface TargetHitProfile {
  targetId: string; // stable id of the physical target (record provenance)
  contactId: string; // the legal contact the torpedo track references
  collisionRadiusM: number; // integer metres, radius >= 1 (closed circle)
  draftM: number; // integer metres, >= 0 (vertical hull span [0 .. draftM])
  // §41 terminal status of the target or null when the caller has no damage
  // state: "FOUNDERED" is not a legal physical object; "SINKING" still is.
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

// ---- §14 predicates (each exported for exhaustive unit proof) --------------

// §14(1): exact integer circle test (µm; bigint-squared, documented above).
// The track and the collision centre are integer micrometre positions; the
// radius is an integer metre. Hit iff inside or ON the radius (inclusive).
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

// §14(1) swept form (P-1, ADR-0046): the torpedo intersects the collision
// geometry at ANY point of the segment it travelled this minute — the minimum
// distance from the centre to the segment [from, to] is within the radius.
// Exact integer arithmetic (bigint); a degenerate segment reduces to the point test.
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
  if (dot >= len2) return false; // beyond `to`, already rejected by the end-point test
  // squared perpendicular distance = |p|^2 - dot^2/len2  (compare scaled by len2)
  return (px * px + py * py) * len2 - dot * dot <= radiusUm * radiusUm * len2;
}

// §14(2): traveled at least the arming distance — floor-metre traveled vs
// armingDistanceM (mirrors the §13 track.armed accounting exactly).
export function traveledArmingDistance(track: TorpedoTrack): boolean {
  return Math.floor(track.distanceTraveledUm / 1_000_000) >= track.armingDistanceM;
}

// §14(3): depth + draft compatible — depthSettingM within [0 .. draftM]. The
// equal boundary is compatible; deeper than the draft passes under the hull.
export function depthDraftCompatible(depthSettingM: number, draftM: number): boolean {
  if (!isInt(depthSettingM) || depthSettingM < 0)
    invariant("depthSettingM", depthSettingM, "depth setting must be an integer metre >= 0");
  if (!isInt(draftM) || draftM < 0)
    invariant("draftM", draftM, "draft must be an integer metre >= 0");
  return depthSettingM <= draftM;
}

// §14(4): no explicit non-contact result. A null blocker clears the predicate.
export function contactBlockersClear(blocker: TorpedoContactBlocker | null): boolean {
  if (blocker !== null && !(TORPEDO_CONTACT_BLOCKERS as readonly string[]).includes(blocker))
    invariant("blocker", blocker, "blocker must be a canonical §14 blocker or null");
  return blocker === null;
}

// §14(5): the target remains a legal physical object. Legal mirrors the reused
// validateTargetOrder rule set (a known-track member with confidence > 0) —
// returning a MISS rather than throwing; physical = the target's §41 terminal
// status is not FOUNDERED (a sunk ship is no longer a contactable physical
// object; a SINKING ship still is). Fail-safe: returns false instead of
// throwing — a decayed/unknown target is a miss, not an engine crash.
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
  if (!contact) return false; // no legal knowledge of the target
  if (!Number.isInteger(contact.confidence) || contact.confidence <= 0) return false; // fogged
  if (o.terminalStatus === "FOUNDERED") return false; // not a legal physical object
  return true;
}

// The legal contact's position (shape centre): the firing side's knowledge
// estimate only — null when the contact is not a legal known track.
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

// §14(6): impact (minute, substep) strictly after the launch (minute, substep)
// tuple — a torpedo cannot hit at its launch instant or before it fired.
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
// The exact §14 predicate that rejected the contact (null on HIT).
export type TorpedoHitRejection =
  | "NOT_ARMED" // §14(2) failed
  | "GEOMETRY_MISS" // §14(1) failed
  | "DEPTH_INCOMPATIBLE" // §14(3) failed
  | "TARGET_AVOIDED" // §14(4) — explicit avoidance result
  | "TARGET_DECOYED" // §14(4) — explicit decoy result
  | "TARGET_INTERCEPTED" // §14(4) — explicit interception result
  | "TORPEDO_FAILURE" // §14(4) — explicit in-flight failure result
  | "NO_LEGAL_TARGET" // §14(5) — no known contact (incl. area fire)
  | "TARGET_NOT_PHYSICAL" // §14(5) — known contact but target foundered
  | "INVALID_IMPACT_ORDER"; // §14(6) — impact not strictly after launch

export interface TorpedoHitPredicates {
  blockersClear: boolean; // §14(4)
  orderingValid: boolean; // §14(6)
  targetLegal: boolean; // §14(5)
  geometryIntersects: boolean; // §14(1)
  depthCompatible: boolean; // §14(3)
  traveledArmingDistance: boolean; // §14(2)
}

export interface TorpedoHitResolution {
  hit: boolean;
  outcome: TorpedoHitOutcome;
  rejection: TorpedoHitRejection | null; // the rejected §14 predicate (null on HIT)
  reasonCode: string | null; // TORPEDO_HIT_RESOLVED on HIT; null on MISS
  predicates: TorpedoHitPredicates; // every §14 predicate recorded for audit
  trackId: string;
  targetContactId: string; // the track's target contact id (or NO_TARGET_CONTACT)
  launchMinute: number;
  launchSubstep: number;
  impactMinute: number;
  impactSubstep: number;
  // Geometry provenance (the detonation seam): the legal contact centre the
  // shape sat at and the shape/vertical data consumed (firing-side knowledge).
  collisionCentre: Position | null;
  collisionRadiusM: number | null;
  draftM: number | null;
}

// §14 composed resolver: evaluates every predicate in the documented order —
// blockers(1) -> ordering(2) -> target legality/physicality(3) -> geometry(4)
// -> depth(5) -> arming(6) — and records ALL of them. The FIRST failing
// predicate becomes the recorded rejection; the rest are still recorded for
// audit. Throws TORPEDO_STATE_INVARIANT_FAILED only for a structurally invalid
// input (terminal track / malformed profile / bad integers), NEVER merely for
// a legitimate §14 miss.
export function resolveTorpedoHit(o: {
  track: TorpedoTrack; // authoritative RUNNING track (§13)
  target: TargetHitProfile | null; // null === area fire (no target at all)
  knownTracks: Map<string, ContactTrack> | ContactTrack[]; // legal contact surface
  blocker: TorpedoContactBlocker | null; // explicit non-contact result or none
  impactMinute: number;
  impactSubstep: number;
  /** P-1 (ADR-0046): the track position at the start of this minute's advance —
   *  when present, geometry is tested along the swept segment, not only the end point. */
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

  // §14(5): area fire has no target at all; otherwise the profile's contact
  // must be a legal known track on a physical (not foundered) object.
  const hasTarget = o.target !== null && o.track.targetContactId !== NO_TARGET_CONTACT;
  const targetLegal = hasTarget
    ? isLegalTarget({
        contactId: o.target!.contactId,
        knownTracks: o.knownTracks,
        terminalStatus: o.target!.terminalStatus,
      })
    : false;

  // §14(1): only meaningful against a legal target — anchored at the LEGAL
  // CONTACT position (firing-side knowledge; hidden true state never used).
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

  // First failing §14 predicate is the recorded rejection (documented order).
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
