import type { RandomEngine } from "@bluewave/random";
import type { Position } from "../core/position.js";
import type { ContactTrack } from "../contact/targeting.js";
import {
  VISUAL_DETECTION_RANGE_UM,
  NEUTRAL_VISIBILITY_MULTIPLIER_BP,
  VISIBILITY_BP_SCALE,
} from "./constants.js";

export type { Position };

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

export type LosResolver = (a: Position, b: Position) => boolean;
export function hasLineOfSight(a: Position, b: Position, los: LosResolver = () => true): boolean {
  return los(a, b);
}

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
  const stream = engine.stream(streamId);
  return stream.next() < DETECTION_RETENTION_BP / VISIBILITY_BP_SCALE;
}

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
  for (const observer of input.observers) {
    for (const asset of input.assets) {
      if (observer.sideId === asset.sideId) continue;
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
        confidence: 10_000,
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
