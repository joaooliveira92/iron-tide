import type { DesignDraft } from "@bluewave/ship-design";
import { type BowStyle, PLAN_PAD, PLAN_W, type SternStyle, stationX } from "./geometry.js";
import {
  BOTTOM_PAD,
  DEPTH_OF_LENGTH,
  DRAUGHT_OF_DEPTH,
  FUNNEL_RISE,
  MIN_FUNNEL_RISE,
  PROFILE_H,
  PROFILE_W,
  SHEER_CAP_OF_DEPTH,
  SHEER_GAIN,
  SHEER_KNEE,
  STERN_SHEER_RATIO,
  TOP_PAD,
} from "./profile-constants.js";
import { type ProfileAnchors, buildOutline } from "./profile-outline.js";
import {
  type PathSegment,
  type Point,
  clamp,
  finiteOr,
  pathPoints,
  polygonPoints,
  samplePath,
  serializePath,
} from "./path.js";

export { PROFILE_H, PROFILE_W };
export { pathPoints, polygonPoints, samplePath, serializePath };
export type { PathSegment, Point };
export type { ProfileAnchors };
export {
  type FunnelInput,
  type FunnelShape,
  type HouseMasses,
  funnelShapes,
  houseMasses,
} from "./profile-structures.js";

export function displaySheerRise(sheerBp: number): number {
  const rise = Math.max(0, finiteOr((sheerBp - 10000) / 10000, 0));
  const amplified = rise + (SHEER_GAIN * rise * SHEER_KNEE) / (SHEER_KNEE + rise);
  return Math.min(SHEER_CAP_OF_DEPTH, amplified);
}

export interface ProfileFrame {
  readonly raw: { readonly lengthM: number; readonly depthM: number; readonly draughtM: number };
  readonly depthM: number;
  readonly draughtM: number;
  readonly vScale: number;
  readonly waterlineY: number;
  readonly keelBaseY: number;
  readonly deckMidY: number;
  readonly x: (permille: number) => number;
  readonly deckY: (t: number) => number;
  readonly bow: BowStyle;
  readonly stern: SternStyle;
  readonly anchors: ProfileAnchors;
  readonly outline: readonly PathSegment[];
}

interface HullMetrics {
  readonly rawLengthM: number;
  readonly rawDepthM: number;
  readonly rawDraughtM: number;
  readonly lengthM: number;
  readonly depthM: number;
  readonly draughtM: number;
}

function hullMetrics(hull: DesignDraft["hull"]): HullMetrics {
  const rawLengthM = Number(hull.lengthWl) / 1000;
  const rawDepthM = Number(hull.depthToMainDeck) / 1000;
  const rawDraughtM = Number(hull.draught) / 1000;
  const lengthM = rawLengthM > 0 && Number.isFinite(rawLengthM) ? rawLengthM : 1;
  const depthM = clamp(
    finiteOr(rawDepthM, lengthM * 0.1),
    lengthM * DEPTH_OF_LENGTH.min,
    lengthM * DEPTH_OF_LENGTH.max,
  );
  const draughtM = clamp(
    finiteOr(rawDraughtM, depthM * 0.5),
    depthM * DRAUGHT_OF_DEPTH.min,
    depthM * DRAUGHT_OF_DEPTH.max,
  );
  return { rawLengthM, rawDepthM, rawDraughtM, lengthM, depthM, draughtM };
}

function sheerDeckY(deckMidY: number, bowRisePx: number, t: number): number {
  const clamped = clamp(t, 0, 1);
  const u = Math.abs(2 * clamped - 1);
  const rise = clamped < 0.5 ? bowRisePx : bowRisePx * STERN_SHEER_RATIO;
  return deckMidY - rise * u * u;
}

export function profileFrame(
  hull: DesignDraft["hull"],
  sheerBp: number,
  bow: BowStyle = "ram",
  stern: SternStyle = "counter",
): ProfileFrame {
  const m = hullMetrics(hull);
  const hScale = (PLAN_W - 2 * PLAN_PAD) / m.lengthM;
  const sheerM = displaySheerRise(sheerBp) * m.depthM;
  const headroomM = Math.max(sheerM + MIN_FUNNEL_RISE * m.depthM, FUNNEL_RISE * m.depthM);
  const available = PROFILE_H - TOP_PAD - BOTTOM_PAD;
  const vScale = Math.min(hScale, available / (m.depthM + headroomM));
  const deckMidY = TOP_PAD + headroomM * vScale;
  const waterlineY = deckMidY + (m.depthM - m.draughtM) * vScale;
  const keelBaseY = waterlineY + m.draughtM * vScale;
  const bowRisePx = sheerM * vScale;
  const deckY = (t: number) => sheerDeckY(deckMidY, bowRisePx, t);
  const { outline, anchors } = buildOutline({
    bow,
    stern,
    deckY,
    waterlineY,
    keelBaseY,
  });
  return {
    raw: { lengthM: m.rawLengthM, depthM: m.rawDepthM, draughtM: m.rawDraughtM },
    depthM: m.depthM,
    draughtM: m.draughtM,
    vScale,
    waterlineY,
    keelBaseY,
    deckMidY,
    x: stationX,
    deckY,
    bow,
    stern,
    anchors,
    outline,
  };
}
