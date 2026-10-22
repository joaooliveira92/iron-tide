import { useState } from "react";

export const SPLIT_STORAGE_KEY = "bluewave-drawing-board-split";
export const SPLIT_DEFAULT = 58;
export const SPLIT_MIN = 30;
export const SPLIT_MAX = 60;
export const TAB_PANE_MIN = "34rem";

export const clampSplit = (pct: number): number =>
  Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));

export function readStoredSplit(): number {
  try {
    const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    return stored > 0 ? clampSplit(stored) : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}

export function useSplitWidth(): readonly [number, (pct: number) => void] {
  const [pct, setPct] = useState(readStoredSplit);
  const set = (next: number) => {
    const clamped = clampSplit(next);
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(clamped));
    } catch {}
    setPct(clamped);
  };
  return [pct, set];
}
