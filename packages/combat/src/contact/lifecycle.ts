import type { ContactTrack } from "./targeting.js";
import { validateTargetOrder } from "./targeting.js";
import type { Position } from "../spotting/detection.js";
import {
  CONTACT_CONFIDENCE_MAX_BP,
  CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE,
  CONTACT_STALE_THRESHOLD_BP,
} from "./constants.js";

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

export function ageContact(track: TacticalContact, minutes: number): TacticalContact {
  const decay = CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE * minutes;
  const confidence = Math.max(0, track.confidence - decay);
  return { ...track, confidence, stale: confidence <= CONTACT_STALE_THRESHOLD_BP };
}

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

export function isStale(track: TacticalContact): boolean {
  return track.stale || track.confidence <= CONTACT_STALE_THRESHOLD_BP;
}

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
