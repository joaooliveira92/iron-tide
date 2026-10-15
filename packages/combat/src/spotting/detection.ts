// DESIGN-38 §3 step 8: deterministic detection model over fixed-point positions.
// Baseline clear daylight only; random scatter (if any) is via domain-separated
// keyed streams. No ambient I/O, clock, or Math.random().
import type { RandomEngine } from "@bluewave/random";
import type { ContactTrack } from "../targeting.js";
import {
  VISUAL_DETECTION_RANGE_UM,
  NEUTRAL_VISIBILITY_MULTIPLIER_BP,
  VISIBILITY_BP_SCALE,
} from "./constants.js";

export type Position = [number, number];

// Detection geometry is compared in a 1-metre quantum (positions are integer
// micrometres). Bound analysis (DESIGN-07): coordinates are bounded by realistic
// tactical areas (<= ~1e11 µm), so metre-scaled deltas stay <= ~1e5; their
// squared sum (<~1e10) is far below Number.MAX_SAFE_INTEGER (9.007e15). This
// keeps the authoritative range comparison exact fixed-point integer, avoiding
// the ~1e21 unsafe-integer squared-distance of raw micrometres.
export const DETECTION_GEOMETRY_METRE_UM = 1_000_000 as const;

export function distanceSq(a: Position, b: Position): number {
  const ax = Math.floor(a[0] / DETECTION_GEOMETRY_METRE_UM);
  const ay = Math.floor(a[1] / DETECTION_GEOMETRY_METRE_UM);
  const bx = Math.floor(b[0] / DETECTION_GEOMETRY_METRE_UM);
  const by = Math.floor(b[1] / DETECTION_GEOMETRY_METRE_UM);
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// AC-8: pure flat-open-sea line-of-sight predicate. Baseline returns true for
// any two points on the flat sea; the seam accepts an optional geometry resolver
// for later baths/landmasses. Deterministic, no I/O.
export type LosResolver = (a: Position, b: Position) => boolean;
export function hasLineOfSight(a: Position, b: Position, los: LosResolver = () => true): boolean {
  return los(a, b);
}

// AC-7: detection when target within sensor range (scaled by the neutral
// visibility multiplier) AND line-of-sight. Deterministic. The optional keyed
// engine/stream seam reserves a deterministic confirmation draw for later
// weather/smoke modifiers (B-5); the shipped baseline retention probability
// is 100% under clear daylight, so unseeded calls are exactly range+LOS.
export interface DetectionContext {
  observer: Position;
  target: Position;
  rangeUm: number;
  visibilityMultiplierBp?: number;
  los?: LosResolver;
}
export const DETECTION_RETENTION_BP = 10_000 as const;
export function isDetected(
  ctx: DetectionContext,
  engine?: RandomEngine,
  streamId?: string,
): boolean {
  if (!hasLineOfSight(ctx.observer, ctx.target, ctx.los)) return false;
  const visibilityBp = ctx.visibilityMultiplierBp ?? NEUTRAL_VISIBILITY_MULTIPLIER_BP;
  const effectiveRangeUm = Math.floor((ctx.rangeUm * visibilityBp) / VISIBILITY_BP_SCALE);
  const effectiveRangeM = Math.floor(effectiveRangeUm / DETECTION_GEOMETRY_METRE_UM);
  const inRange = distanceSq(ctx.observer, ctx.target) <= effectiveRangeM * effectiveRangeM;
  if (!inRange) return false;
  if (!engine || !streamId) return true;
  // keyed confirmation draw: baseline retention 10_000 bp = always detected;
  // B-5 lowers the constant while keeping the seam deterministic.
  const stream = engine.stream(streamId);
  return stream.next() < DETECTION_RETENTION_BP / VISIBILITY_BP_SCALE;
}

// AC-9: resolve_sensors_spotting produces contact tracks ONLY from detected true
// assets, recording reason/source; never a hidden-identity leak. Each detected
// asset yields one deduped ContactTrack keyed by a deterministic contact id.
export interface TrueAsset {
  assetId: string;
  sideId: string;
  position: Position;
  heading: number;
  speedBpKnots: number;
  estimatedClass?: string;
}
export interface SensorObserver {
  observerId: string;
  sideId: string;
  position: Position;
  rangeUm?: number;
}
export interface ResolveSpottingInput {
  observers: SensorObserver[];
  assets: TrueAsset[];
  battleId: string;
  minute: number;
  observationTime: string;
  contractRangeUm?: number;
}
export interface SpottingContact extends ContactTrack {
  assetId: string;
  sideId: string;
  sources: string[];
}

export function resolveSensorsSpotting(input: ResolveSpottingInput): SpottingContact[] {
  const rangeUm = input.contractRangeUm ?? VISUAL_DETECTION_RANGE_UM;
  const contacts: SpottingContact[] = [];
  // deterministic iteration in observer then asset declared order.
  for (const observer of input.observers) {
    for (const asset of input.assets) {
      if (observer.sideId === asset.sideId) continue; // friendly assets are not "contacts"
      if (!isDetected({ observer: observer.position, target: asset.position, rangeUm })) {
        continue;
      }
      const contactId = `${input.battleId}:${asset.assetId}`;
      const existing = contacts.find((c) => c.contactId === contactId);
      const record: SpottingContact = {
        contactId,
        assetId: asset.assetId,
        sideId: asset.sideId,
        estimatedIdentity: asset.estimatedClass ?? `unknown:${asset.assetId}`,
        position: asset.position,
        course: asset.heading,
        speed: asset.speedBpKnots,
        confidence: 10_000, // fresh, high-confidence baseline contact
        observationTime: input.observationTime,
        source: "visual",
        uncertainty: 0,
        sources: [observer.observerId],
      };
      if (existing) {
        existing.sources.push(observer.observerId);
        existing.confidence = Math.max(existing.confidence, record.confidence);
      } else {
        contacts.push(record);
      }
    }
  }
  return contacts;
}
