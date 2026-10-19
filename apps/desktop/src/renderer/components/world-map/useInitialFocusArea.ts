import { useEffect } from "react";
import { homeFocusPoint } from "./campaign-map-join.js";
import type { Projection } from "./projection.js";

/**
 * How far the camera zooms in when the chart opens centred on a nation's home
 * waters. Matches the area tree's own "focus an area" scale (`WorldMapChart.focusArea`).
 */
export const HOME_FOCUS_SCALE = 3.5;

/** The only camera capability this hook needs (keeps it unit-testable without a DOM). */
export interface FocusableCamera {
  readonly focusOn: (x: number, y: number, scale?: number) => void;
}

/**
 * Centres the camera on a nation's home-waters campaign area once per mount —
 * the Overview opens on the player's own waters. A null/unknown area, or one
 * whose fixture polygon has no geometry, leaves the camera untouched (it stays
 * at "fit world") rather than guessing.
 */
export function useInitialFocusArea(
  camera: FocusableCamera,
  campaignAreaId: string | null,
  projection: Projection,
  centre: number,
): void {
  useEffect(() => {
    const point = homeFocusPoint(campaignAreaId);
    if (point === null) return;
    // The anchor is lon/lat; the camera works in projected world units (as the coastline does).
    const [x, y] = projection.project(point[0] - centre, point[1]);
    camera.focusOn(x, y, HOME_FOCUS_SCALE);
    // `camera` is a stable bundle of refs; only a different area should re-focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignAreaId]);
}
