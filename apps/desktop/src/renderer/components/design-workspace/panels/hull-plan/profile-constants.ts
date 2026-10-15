import { PLAN_W, stationX } from "./geometry.js";

/**
 * Profile drawing conventions and shared scale, kept in one place so the frame, the outline and the deck
 * structures all read from the same numbers. Each value is a documented DISPLAY clamp or CONVENTION; see the
 * consuming module for its meaning. Coordinates use `stationX` for horizontal placement, shared with the plan.
 */
export const PROFILE_W = PLAN_W;
export const PROFILE_H = 132;
export const TOP_PAD = 14;
export const BOTTOM_PAD = 20;

/** DISPLAY clamp: drawn depth as a fraction of waterline length, so no hull is unreadably thin or tall. */
export const DEPTH_OF_LENGTH = { min: 0.04, max: 0.2 } as const;
/** DISPLAY clamp: drawn draught as a fraction of drawn depth, so there is always some freeboard and some draught. */
export const DRAUGHT_OF_DEPTH = { min: 0.15, max: 0.9 } as const;
/** DISPLAY: the amplified sheer rise never exceeds this fraction of the depth. */
export const SHEER_CAP_OF_DEPTH = 0.4;
/** DISPLAY: gain and knee of the sheer amplification (see `displaySheerRise`). */
export const SHEER_GAIN = 1.5;
export const SHEER_KNEE = 0.1;
/** CONVENTION: the stern's sheer rise relative to the bow's. */
export const STERN_SHEER_RATIO = 0.6;

/** CONVENTION: heights above the deck as fractions of the drawn depth. */
export const FUNNEL_RISE = 0.75;
export const MIN_FUNNEL_RISE = 0.25;
export const LOWER_HOUSE_RISE = 0.22;
export const UPPER_HOUSE_RISE = 0.14;
/** CONVENTION: funnel width at the base as a fraction of drawn depth px; the top is narrower and raked aft. */
export const FUNNEL_WIDTH_OF_DEPTH = 0.3;
export const FUNNEL_TOP_TAPER = 0.82;
export const FUNNEL_RAKE_OF_WIDTH = 0.15;
export const FUNNEL_MIN_WIDTH_PX = 3;
export const FUNNEL_GAP_PX = 3;
/** CONVENTION: superstructure is kept off the stem and stern (permille of waterline length). */
export const HOUSE_LIMITS = { min: 50, max: 950 } as const;
export const HOUSE_SAMPLES = 8;

/** Waterline length in px, and the bow/stern x positions. */
export const X_BOW = stationX(0);
export const X_STERN = stationX(1000);
export const LENGTH_PX = X_STERN - X_BOW;
export const along = (fraction: number) => LENGTH_PX * fraction;
