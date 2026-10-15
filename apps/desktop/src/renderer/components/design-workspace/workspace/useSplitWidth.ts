import { useState } from "react";

export const SPLIT_STORAGE_KEY = "bluewave-drawing-board-split";
/**
 * Share of the workspace width given to the ship view, in percent. The ship drawing is the board's focus, so it
 * opens at 58% — inside the 55–60% band the plan is read at — with the tab pane still wide enough for its forms.
 * A stored preference is never replaced by this default, only clamped to the limits below.
 */
export const SPLIT_DEFAULT = 58;
export const SPLIT_MIN = 30;
export const SPLIT_MAX = 60;
/** Narrowest the tab pane may get, whatever the stored share: its forms and tab strip stay usable. */
export const TAB_PANE_MIN = "34rem";

export const clampSplit = (pct: number): number =>
  Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));

/** The stored ship-view width, or the default for anything missing or out of shape. */
export function readStoredSplit(): number {
  try {
    const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    return stored > 0 ? clampSplit(stored) : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** The player's preferred ship-view width, remembered on this machine across sessions. */
export function useSplitWidth(): readonly [number, (pct: number) => void] {
  const [pct, setPct] = useState(readStoredSplit);
  const set = (next: number) => {
    const clamped = clampSplit(next);
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(clamped));
    } catch {
      // Storage unavailable: the width still applies for this session.
    }
    setPct(clamped);
  };
  return [pct, set];
}
