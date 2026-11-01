import { UM_PER_METRE } from "../../../lib/presentation-format/units.js";
import { clampMetersPerPixel, zoomMetersPerPixel } from "../../tactical-map/tacticalScale.js";

export type WorldPoint = readonly [number, number];

export interface TacticalViewport {
  readonly width: number;
  readonly height: number;
}

export interface TacticalCamera {
  readonly centreX: number;
  readonly centreY: number;
  readonly metresPerPixel: number;
}

export const PROVISIONAL_FIT_MARGIN = 0.8;
export const PROVISIONAL_ZOOM_STEP = 1.5;

const umPerPixel = (camera: TacticalCamera): number => camera.metresPerPixel * UM_PER_METRE;

export function compassFromHeading(headingDeg: number): number {
  return (((90 - headingDeg) % 360) + 360) % 360;
}

export function headingFromCompass(compassDeg: number): number {
  return (((90 - compassDeg) % 360) + 360) % 360;
}

export function worldToScreen(
  camera: TacticalCamera,
  viewport: TacticalViewport,
  point: WorldPoint,
): readonly [number, number] {
  const scale = umPerPixel(camera);
  return [
    viewport.width / 2 + (point[0] - camera.centreX) / scale,
    viewport.height / 2 - (point[1] - camera.centreY) / scale,
  ];
}

export function screenToWorld(
  camera: TacticalCamera,
  viewport: TacticalViewport,
  screen: readonly [number, number],
): WorldPoint {
  const scale = umPerPixel(camera);
  return [
    camera.centreX + (screen[0] - viewport.width / 2) * scale,
    camera.centreY - (screen[1] - viewport.height / 2) * scale,
  ];
}

export function panCamera(
  camera: TacticalCamera,
  deltaPixels: readonly [number, number],
): TacticalCamera {
  const scale = umPerPixel(camera);
  return {
    ...camera,
    centreX: camera.centreX - deltaPixels[0] * scale,
    centreY: camera.centreY + deltaPixels[1] * scale,
  };
}

export function zoomCameraAt(
  camera: TacticalCamera,
  viewport: TacticalViewport,
  factor: number,
  anchor: readonly [number, number],
): TacticalCamera {
  const before = screenToWorld(camera, viewport, anchor);
  const metresPerPixel = zoomMetersPerPixel(camera.metresPerPixel, factor);
  const zoomed = { ...camera, metresPerPixel };
  const after = screenToWorld(zoomed, viewport, anchor);
  return {
    metresPerPixel,
    centreX: camera.centreX + (before[0] - after[0]),
    centreY: camera.centreY + (before[1] - after[1]),
  };
}

export function centreCameraOn(camera: TacticalCamera, point: WorldPoint): TacticalCamera {
  return { ...camera, centreX: point[0], centreY: point[1] };
}

export function fitCamera(
  points: readonly WorldPoint[],
  viewport: TacticalViewport,
  fallback: TacticalCamera,
): TacticalCamera {
  if (points.length === 0) return fallback;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanUm = Math.max(maxX - minX, maxY - minY);
  const usablePixels = Math.max(
    1,
    Math.min(viewport.width, viewport.height) * PROVISIONAL_FIT_MARGIN,
  );
  return {
    centreX: Math.round((minX + maxX) / 2),
    centreY: Math.round((minY + maxY) / 2),
    metresPerPixel: clampMetersPerPixel(spanUm / UM_PER_METRE / usablePixels),
  };
}

export interface LabelCandidate {
  readonly key: string;
  readonly priority: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const overlaps = (a: LabelCandidate, b: LabelCandidate): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export function visibleLabelKeys(candidates: readonly LabelCandidate[]): ReadonlySet<string> {
  const ordered = [...candidates].sort(
    (a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const placed: LabelCandidate[] = [];
  for (const candidate of ordered) {
    if (!placed.some((other) => overlaps(candidate, other))) placed.push(candidate);
  }
  return new Set(placed.map((candidate) => candidate.key));
}
