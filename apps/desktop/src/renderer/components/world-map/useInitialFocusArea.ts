import { useEffect } from "react";
import type { FlatPolygon } from "../../lib/simplify-geometry.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import { homeFocusPoint } from "./campaign-map-join.js";
import type { Projection } from "./projection.js";

export const HOME_FOCUS_SCALE = 3.5;

const MAX_LAND_SPAN_DEGREES = 30;

function outerBox(polygon: FlatPolygon): readonly [number, number, number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const outer = polygon[0] ?? [];
  for (let k = 0; k < outer.length; k += 2) {
    const x = outer[k] as number;
    const y = outer[k + 1] as number;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return [minX, maxX, minY, maxY];
}

export function nationFocusPoint(
  anchor: readonly [number, number],
  nationId: string | null,
  borders: Readonly<Record<string, readonly FlatPolygon[]>> = BORDERS_1880,
): readonly [number, number] {
  const polygons = nationId === null ? undefined : borders[nationId];
  if (polygons === undefined || polygons.length === 0) return anchor;
  let main: readonly [number, number, number, number] | null = null;
  let mainArea = -1;
  for (const polygon of polygons) {
    const box = outerBox(polygon);
    const area = (box[1] - box[0]) * (box[3] - box[2]);
    if (area > mainArea) {
      main = box;
      mainArea = area;
    }
  }
  if (main === null) return anchor;
  if (main[1] - main[0] > MAX_LAND_SPAN_DEGREES || main[3] - main[2] > MAX_LAND_SPAN_DEGREES) {
    return anchor;
  }
  return [
    (Math.min(main[0], anchor[0]) + Math.max(main[1], anchor[0])) / 2,
    (Math.min(main[2], anchor[1]) + Math.max(main[3], anchor[1])) / 2,
  ];
}

export interface FocusableCamera {
  readonly focusOn: (x: number, y: number, scale?: number) => void;
}

export function useInitialFocusArea(
  camera: FocusableCamera,
  campaignAreaId: string | null,
  projection: Projection,
  centre: number,
  nationId: string | null = null,
): void {
  useEffect(() => {
    const point = homeFocusPoint(campaignAreaId);
    if (point === null) return;
    const target = nationFocusPoint(point, nationId);
    const [x, y] = projection.project(target[0] - centre, target[1]);
    camera.focusOn(x, y, HOME_FOCUS_SCALE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignAreaId, nationId]);
}
