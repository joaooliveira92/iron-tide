import type { DesignDraft, MountSide } from "@bluewave/ship-design";
import type { BowStyle, SternStyle } from "./hull-character.js";
import { type HullLines, waterplaneShape } from "./waterplane.js";

export { bowStyleFor, sternStyleFor } from "./hull-character.js";
export type { BowStyle, SternStyle };
export { waterplaneShape };
export type { HullLines };

/**
 * Plan-view geometry for the hull plan. SCHEMATIC: see HullPlanPanel. Bow is on the left, so starboard is
 * the upper side of the drawing and port the lower (looking forward from the stern, starboard is on the right).
 * Bow/stern character lives in `hull-character.ts` and the waterplane maths in `waterplane.ts`; both are
 * re-exported here so `geometry` stays the single import for the plan drawing.
 */
export const PLAN_W = 640;
export const PLAN_H = 170;
/** Left/right padding, shared with the profile so both views use the same horizontal origin and length scale. */
export const PLAN_PAD = 32;
export const PLAN_MID = PLAN_H / 2;

export interface PlanFrame {
  readonly lengthM: number;
  readonly beamM: number;
  /** Half the drawn beam, px. */
  readonly maxHalf: number;
  readonly x: (permille: number) => number;
  /** Half-beam (px) at a station fraction 0..1 (0 = bow). */
  readonly half: (t: number) => number;
  readonly lcbPermille: number;
  readonly bow: BowStyle;
  readonly stern: SternStyle;
}

export function planFrame(hull: DesignDraft["hull"], lines?: HullLines): PlanFrame {
  const lengthM = Number(hull.lengthWl) / 1000;
  const beamM = Number(hull.beam) / 1000;
  const span = PLAN_W - 2 * PLAN_PAD;
  const ratio = lengthM > 0 ? beamM / lengthM : 0;
  const maxHalf = Math.max(2, Math.min(PLAN_MID - 14, (span * ratio) / 2));
  const shape = waterplaneShape(lines);
  return {
    lengthM,
    beamM,
    maxHalf,
    x: stationX,
    half: (t) => maxHalf * shape(t),
    lcbPermille: lines?.lcbPermille ?? 500,
    bow: lines?.bow ?? "ram",
    stern: lines?.stern ?? "counter",
  };
}

const clampPermille = (p: number) => Math.min(1000, Math.max(0, p));

/** Horizontal position (px, bow at the left) of a station in permille of the waterline length; shared by plan and profile. */
export function stationX(permille: number): number {
  return PLAN_PAD + ((PLAN_W - 2 * PLAN_PAD) * clampPermille(permille)) / 1000;
}

export interface PlanPoint {
  readonly x: number;
  readonly y: number;
}

/** Position of a fitting. Centreline fittings get a cosmetic vertical nudge (by `index`) so overlaps stay visible. */
export function fittingPoint(
  frame: PlanFrame,
  stationPermille: number,
  side: MountSide | undefined,
  index: number,
): PlanPoint {
  const sign = side === "STBD" ? -1 : side === "PORT" ? 1 : 0;
  return {
    x: frame.x(stationPermille),
    y: PLAN_MID + sign * frame.maxHalf * 0.5 + (sign === 0 ? ((index % 3) - 1) * 6 : 0),
  };
}
