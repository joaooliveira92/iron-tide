import type { CSSProperties } from "react";

/**
 * Electron treats the header as the window's drag handle. Interactive children
 * opt back out, or they cannot be clicked.
 */
export const DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
export const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;
