import { clampMetersPerPixel } from "../../tactical-map/tacticalScale.js";
import { screenToWorld, type TacticalCamera, type TacticalViewport } from "./tactical-geometry.js";

export interface ScreenRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export const MIN_RECTANGLE_PIXELS = 12;

export function rectangleFromCorners(
  from: readonly [number, number],
  to: readonly [number, number],
): ScreenRectangle {
  return {
    left: Math.min(from[0], to[0]),
    top: Math.min(from[1], to[1]),
    width: Math.abs(to[0] - from[0]),
    height: Math.abs(to[1] - from[1]),
  };
}

export function isUsableRectangle(rect: ScreenRectangle): boolean {
  return rect.width >= MIN_RECTANGLE_PIXELS && rect.height >= MIN_RECTANGLE_PIXELS;
}

export function rectangleCamera(
  camera: TacticalCamera,
  viewport: TacticalViewport,
  rect: ScreenRectangle,
): TacticalCamera {
  const centre = screenToWorld(camera, viewport, [
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  ]);
  const fraction = Math.max(rect.width / viewport.width, rect.height / viewport.height);
  return {
    centreX: Math.round(centre[0]),
    centreY: Math.round(centre[1]),
    metresPerPixel: clampMetersPerPixel(camera.metresPerPixel * fraction),
  };
}
