//packages/combat/src/contact/lifecycle.ts
// DESIGN-38 §19/§3-step-4: contact-track create/update/age/merge lifecycle,
// deterministic by stable asset key. The authoritative contact shape (TacticalContact)
// extends the DESIGN-38 ContactTrack fields (identity/position/course/speed/
// confidence/observation time/source/uncertainty). Fog-of-war is enforced by
// reusing validateTargetOrder from targeting.ts (AC-11).
import type { ContactTrack } from "../targeting.js";
import { validateTargetOrder } from "../targeting.js";
import type { Position } from "../spotting/detection.js";
import {
  CONTACT_CONFIDENCE_MAX_BP,
  CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE,
  CONTACT_STALE_THRESHOLD_BP,
} from "./constants.js";

// AC-10 contact shape — unified authoritative contact record. Deterministic
// contact id derived from battle + asset (stable key, no ambient randomness).
export interface TacticalContact extends ContactTrack {
  assetId: string;
  sideId: string;
  battleId: string;
  lastUpdateMinute: number;
  stale: boolean;
  sources: string[];
  rngDecisionId?: string;
}

export function contactKey(battleId: string, assetId: string): string {
  return `${battleId}:${assetId}`;
}

export function createContactTrack(opts: {
  battleId: string;
  assetId: string;
  sideId: string;
  estimatedIdentity: string;
  position: Position;
  course: number;
  speedBpKnots: number;
  observationTime: string;
  minute: number;
  source?: string;
  confidenceBp?: number;
  uncertainty?: number;
}): TacticalContact {
  return {
    contactId: contactKey(opts.battleId, opts.assetId),
    battleId: opts.battleId,
    assetId: opts.assetId,
    sideId: opts.sideId,
    estimatedIdentity: opts.estimatedIdentity,
    position: opts.position,
    course: opts.course,
    speed: opts.speedBpKnots,
    confidence: opts.confidenceBp ?? CONTACT_CONFIDENCE_MAX_BP,
    observationTime: opts.observationTime,
    source: opts.source ?? "visual",
    uncertainty: opts.uncertainty ?? 0,
    lastUpdateMinute: opts.minute,
    stale: false,
    sources: [opts.source ?? "visual"],
  };
}

// AC-10 aging: decay confidence by the versioned slope * minutes; clamp at 0 and
// mark stale at/under the staleness threshold. Deterministic, pure.
export function ageContact(track: TacticalContact, minutes: number): TacticalContact {
  const decay = CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE * minutes;
  const confidence = Math.max(0, track.confidence - decay);
  return { ...track, confidence, stale: confidence <= CONTACT_STALE_THRESHOLD_BP };
}

// AC-10 merge/update: fold a new observation into an existing track, resetting
// confidence (fresh observation) and updating kinematic fields + sources.
export function updateContact(
  track: TacticalContact,
  observation: {
    position: Position;
    course: number;
    speedBpKnots: number;
    observationTime: string;
    minute: number;
    source?: string;
  },
): TacticalContact {
  const sources = track.sources.includes(observation.source ?? "visual")
    ? track.sources
    : [...track.sources, observation.source ?? "visual"];
  return {
    ...track,
    position: observation.position,
    course: observation.course,
    speed: observation.speedBpKnots,
    observationTime: observation.observationTime,
    confidence: CONTACT_CONFIDENCE_MAX_BP,
    stale: false,
    lastUpdateMinute: observation.minute,
    sources,
  };
}

// AC-10 staleness predicate.
export function isStale(track: TacticalContact): boolean {
  return track.stale || track.confidence <= CONTACT_STALE_THRESHOLD_BP;
}

// AC-11 fog-of-war: a target order MUST reference a legal known ContactTrack.
// Reuses validateTargetOrder; a reference to a hidden true asset (no legal track)
// fails with TACTICAL_FOG_OF_WAR_VIOLATION.
export function resolveLegalTarget(
  contactId: string,
  knownTracks: Map<string, TacticalContact> | readonly TacticalContact[],
  trueAssetId?: string,
): TacticalContact {
  const map = Array.isArray(knownTracks)
    ? new Map(knownTracks.map((c) => [c.contactId, c as ContactTrack]))
    : (knownTracks as unknown as Map<string, ContactTrack>);
  const resolved = validateTargetOrder(contactId, map, trueAssetId) as TacticalContact;
  return resolved;
}
