import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { plural } from "../../plural.js";
import { funnelPlacements } from "./funnelPlacements.js";
import { PLAN_MID, PLAN_PAD, PLAN_W, type PlanFrame } from "./geometry.js";
import {
  type FunnelShape,
  type HouseMasses,
  type ProfileFrame,
  funnelShapes,
  houseMasses,
} from "./profile-geometry.js";
import type { SectionFacts, ZoneRange } from "./sections.js";

/**
 * Card drawing size (SVG user units). The bands are sized to the content they must hold (a plan whose half-beam
 * is capped at `PLAN_MID - 14`, a profile as tall as the hull plus headroom) rather than padded square, so the
 * card reads landscape instead of portrait.
 */
export const SECTION_W = 400;
export const PAD_X = 14;
export const PLAN_TOP = 6;
export const PLAN_BAND = 160;
export const PROFILE_TOP = PLAN_TOP + PLAN_BAND + 10;
export const PROFILE_BAND = 200;
export const SCALE_Y = PROFILE_TOP + PROFILE_BAND + 16;
export const SECTION_H = SCALE_Y + 6;

/** Card label size, SVG user units, shared by the band captions, callouts and scale. */
export const CARD_FONT = 12;

/** Hard bounds of the station window, in permille (a little past the stem and the stern post). */
const WINDOW_MIN = -25;
const WINDOW_MAX = 1025;
/** Least context (permille of hull) kept on each side of the section, so it never touches the card edge. */
const EDGE_MARGIN = 20;

/** The plan/profile transforms and derived values the magnified section card renders. */
export interface SectionLayout {
  readonly zone: ZoneRange;
  readonly s: number;
  readonly e: number;
  /** Uniform scale (card px per plan unit), used on both axes so neither view is distorted. */
  readonly a: number;
  readonly X: (permille: number) => number;
  readonly b: number;
  readonly ky: number;
  readonly planCy: number;
  readonly planTy: number;
  readonly houses: HouseMasses | undefined;
  readonly funnels: readonly FunnelShape[];
  readonly kp: number;
  readonly profileTy: number;
  readonly pY: (y: number) => number;
  readonly x0: number;
  readonly x1: number;
  readonly step: number;
  readonly ticks: readonly number[];
  /** Accessible name of the drawing. */
  readonly label: string;
}

/**
 * Geometry for the section card: a plan band and a profile band under one uniform transform (the same scale on
 * both axes and both bands), so each band is a faithful crop of the main drawing and can never disagree with it.
 *
 * A uniform scale cannot magnify past the band heights, so the card widens the station window to fill its width
 * instead of squashing the drawing: the section sits centred with its neighbours dimmed around it. Pure: the card
 * component only renders these values. Null when the section has no drawing zone.
 */
export function sectionLayout(
  facts: SectionFacts,
  frame: PlanFrame,
  profile: ProfileFrame,
  draft: DesignDraft,
  content: DrawingBoardContent,
  zones: readonly ZoneRange[],
): SectionLayout | null {
  const zone = facts.zone;
  if (!zone) return null;
  const inner = SECTION_W - 2 * PAD_X;
  const unit = (PLAN_W - 2 * PLAN_PAD) / 1000;
  const superstructure = zones.find((z) => z.id === "SUPERSTRUCTURE");
  const houses = houseMasses(profile, superstructure);
  const funnels = funnelShapes(profile, funnelPlacements(draft, content), houses);
  // The tallest content anywhere on the hull: the window only widens, so this extent keeps the scale safe.
  const tops = [
    ...Array.from({ length: 41 }, (_, i) => profile.deckY(i / 40)),
    ...(houses ? [...houses.lower, ...houses.upper].map((p) => p.y) : []),
    ...funnels.flatMap((f) => f.polygon.map((p) => p.y)),
  ].filter(Number.isFinite);
  const yTop = Math.min(...tops) - 4;
  const yBot = profile.keelBaseY + 3;
  // One scale for both axes and both bands, capped by whichever band is the tighter fit (the profile, which
  // must hold the whole hull height, is usually tighter than the plan's beam).
  const a = Math.min((PLAN_BAND / 2 - 6) / frame.maxHalf, (PROFILE_BAND - 8) / (yBot - yTop));
  // Fill the card's width at that scale by showing more stations; the section keeps at least its own span plus a
  // sliver of each neighbour, so it never sits flush against the card edge.
  const sectionSpan = zone.endPermille - zone.startPermille;
  const minSpan = sectionSpan + 2 * EDGE_MARGIN;
  const span = Math.max(minSpan, inner / (a * unit));
  const centre = (zone.startPermille + zone.endPermille) / 2;
  let s = Math.max(WINDOW_MIN, centre - span / 2);
  let e = Math.min(WINDOW_MAX, centre + span / 2);
  if (e - s < span) {
    // Ran off one end: slide the window back so it still holds the section and as much span as it can.
    if (s <= WINDOW_MIN) e = Math.min(WINDOW_MAX, s + span);
    else s = Math.max(WINDOW_MIN, e - span);
  }
  const scale = Math.min(a, inner / ((e - s) * unit));
  const X = (permille: number) => PAD_X + ((permille - s) / (e - s)) * inner;
  const b = X(0) - scale * PLAN_PAD;
  const planCy = PLAN_TOP + PLAN_BAND / 2;
  const planTy = planCy - scale * PLAN_MID;
  const contentH = scale * (yBot - yTop);
  const profileTy = PROFILE_TOP + (PROFILE_BAND - contentH) / 2 - scale * yTop;
  const pY = (y: number) => scale * y + profileTy;
  const x0 = X(zone.startPermille);
  const x1 = X(zone.endPermille);
  const step = e - s <= 200 ? 10 : e - s <= 450 ? 25 : 50;
  const ticks: number[] = [];
  for (let p = Math.ceil(s / step) * step; p <= e; p += step)
    if (p >= 0 && p <= 1000) ticks.push(p);
  const label = `Detailed drawing of the ${facts.meta.name.toLowerCase()}, stations ${zone.startPermille} to ${zone.endPermille} permille: plan above, profile below, ${plural(facts.fittings.length, "fitting")} numbered${facts.machineryRooms.length ? `, ${plural(facts.machineryRooms.length, "machinery room")}` : ""}${facts.fuelStationPermille !== undefined ? ", fuel stowage" : ""}.`;
  return {
    zone,
    s,
    e,
    a: scale,
    X,
    b,
    ky: scale,
    planCy,
    planTy,
    houses,
    funnels,
    kp: scale,
    profileTy,
    pY,
    x0,
    x1,
    step,
    ticks,
    label,
  };
}
