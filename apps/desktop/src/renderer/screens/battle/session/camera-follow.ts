import {
  centreCameraOn,
  type TacticalCamera,
  type WorldPoint,
} from "../tactical/tactical-geometry.js";

export interface CameraFollow {
  readonly camera: TacticalCamera;
  readonly following: boolean;
}

export function trackFocus(state: CameraFollow, focusPoint: WorldPoint | null): CameraFollow {
  if (!state.following || focusPoint === null) return state;
  return { camera: centreCameraOn(state.camera, focusPoint), following: true };
}

export function applyCameraChange(
  state: CameraFollow,
  next: TacticalCamera,
  focusPoint: WorldPoint | null,
): CameraFollow {
  if (!state.following) return { camera: next, following: false };
  const sameScale = next.metresPerPixel === state.camera.metresPerPixel;
  if (sameScale) {
    const moved = next.centreX !== state.camera.centreX || next.centreY !== state.camera.centreY;
    return moved ? { camera: next, following: false } : state;
  }
  return trackFocus({ camera: next, following: true }, focusPoint);
}
