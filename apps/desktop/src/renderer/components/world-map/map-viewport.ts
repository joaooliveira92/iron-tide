/**
 * Where the main view sits in the world, for the minimap. All values are world
 * user units (the same space as the projection). The map wraps east–west, so a
 * view that straddles the seam is two rectangles.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraState {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export function visibleWorldRects(
  camera: CameraState,
  view: { readonly width: number; readonly height: number },
  world: { readonly width: number; readonly height: number },
  /** Where the view's top-left sits in camera user units (non-zero when letterboxed). */
  origin: { readonly left: number; readonly top: number } = { left: 0, top: 0 },
): Rect[] {
  const width = Math.min(world.width, view.width / camera.scale);
  const height = Math.min(world.height, view.height / camera.scale);
  const y = Math.min(Math.max((origin.top - camera.y) / camera.scale, 0), world.height - height);
  if (width >= world.width) return [{ x: 0, y, width: world.width, height }];
  const x = ((((origin.left - camera.x) / camera.scale) % world.width) + world.width) % world.width;
  const rects: Rect[] = [{ x, y, width, height }];
  if (x + width > world.width) rects.push({ x: x - world.width, y, width, height });
  return rects;
}

/** Minimap fraction (0..1 across/down) to the world point to centre on. */
export function minimapToWorld(
  fraction: { readonly x: number; readonly y: number },
  world: { readonly width: number; readonly height: number },
): { x: number; y: number } {
  return {
    x: Math.min(1, Math.max(0, fraction.x)) * world.width,
    y: Math.min(1, Math.max(0, fraction.y)) * world.height,
  };
}
