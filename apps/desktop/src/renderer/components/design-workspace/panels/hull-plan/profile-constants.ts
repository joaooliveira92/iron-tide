import { PLAN_W, stationX } from "./geometry.js";

export const PROFILE_W = PLAN_W;
export const PROFILE_H = 132;
export const TOP_PAD = 14;
export const BOTTOM_PAD = 20;

export const DEPTH_OF_LENGTH = { min: 0.04, max: 0.2 } as const;
export const DRAUGHT_OF_DEPTH = { min: 0.15, max: 0.9 } as const;
export const SHEER_CAP_OF_DEPTH = 0.4;
export const SHEER_GAIN = 1.5;
export const SHEER_KNEE = 0.1;
export const STERN_SHEER_RATIO = 0.6;

export const FUNNEL_RISE = 0.75;
export const MIN_FUNNEL_RISE = 0.25;
export const LOWER_HOUSE_RISE = 0.22;
export const UPPER_HOUSE_RISE = 0.14;
export const FUNNEL_WIDTH_OF_DEPTH = 0.3;
export const FUNNEL_TOP_TAPER = 0.82;
export const FUNNEL_RAKE_OF_WIDTH = 0.15;
export const FUNNEL_MIN_WIDTH_PX = 3;
export const FUNNEL_GAP_PX = 3;
export const HOUSE_LIMITS = { min: 50, max: 950 } as const;
export const HOUSE_SAMPLES = 8;

export const X_BOW = stationX(0);
export const X_STERN = stationX(1000);
export const LENGTH_PX = X_STERN - X_BOW;
export const along = (fraction: number) => LENGTH_PX * fraction;
