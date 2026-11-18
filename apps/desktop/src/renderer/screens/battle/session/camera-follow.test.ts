import { describe, expect, it } from "vite-plus/test";
import type { TacticalCamera, WorldPoint } from "../tactical/tactical-geometry.js";
import { rectangleCamera } from "../tactical/tactical-rectangle.js";
import {
  applyCameraChange,
  frameRectangle,
  trackFocus,
  type CameraFollow,
} from "./camera-follow.js";

const CAMERA: TacticalCamera = { centreX: 0, centreY: 0, metresPerPixel: 400 };
const FOLLOWING: CameraFollow = { camera: CAMERA, following: true };
const AT: WorldPoint = [9_000, -4_000];

describe("camera follow transition", () => {
  it("moves the centre to the followed point on a tick and keeps the zoom", () => {
    const next = trackFocus(FOLLOWING, AT);
    expect(next.camera).toEqual({ centreX: 9_000, centreY: -4_000, metresPerPixel: 400 });
    expect(next.following).toBe(true);
  });

  it("tracks the point again on every later tick", () => {
    const first = trackFocus(FOLLOWING, AT);
    const second = trackFocus(first, [9_500, -4_200]);
    expect(second.camera.centreX).toBe(9_500);
    expect(second.camera.centreY).toBe(-4_200);
  });

  it("leaves the camera alone when follow is off", () => {
    const off: CameraFollow = { camera: CAMERA, following: false };
    expect(trackFocus(off, AT)).toBe(off);
  });

  it("leaves the camera alone while nothing is selected", () => {
    expect(trackFocus(FOLLOWING, null)).toBe(FOLLOWING);
  });

  it("turns follow off when the user pans", () => {
    const panned = { ...CAMERA, centreX: 1_200 };
    expect(applyCameraChange(FOLLOWING, panned, AT)).toEqual({ camera: panned, following: false });
  });

  it("keeps follow on and centred when the user zooms", () => {
    const zoomed = { centreX: 300, centreY: 200, metresPerPixel: 200 };
    expect(applyCameraChange(FOLLOWING, zoomed, AT)).toEqual({
      camera: { centreX: 9_000, centreY: -4_000, metresPerPixel: 200 },
      following: true,
    });
  });

  it("keeps follow on when a zoom is clamped and the camera does not change", () => {
    expect(applyCameraChange(FOLLOWING, { ...CAMERA }, AT)).toBe(FOLLOWING);
  });

  it("frames a rectangle on the chosen area and stops following", () => {
    const viewport = { width: 800, height: 480 };
    const rect = { left: 600, top: 40, width: 100, height: 60 };
    const next = frameRectangle(FOLLOWING, viewport, rect);
    expect(next.following).toBe(false);
    expect(next.camera).toEqual(rectangleCamera(CAMERA, viewport, rect));
    expect(next.camera.metresPerPixel).toBeLessThan(CAMERA.metresPerPixel);
  });

  it("frames a rectangle with follow already off", () => {
    const off: CameraFollow = { camera: CAMERA, following: false };
    const rect = { left: 200, top: 120, width: 400, height: 240 };
    const next = frameRectangle(off, { width: 800, height: 480 }, rect);
    expect(next).toEqual({ camera: { ...CAMERA, metresPerPixel: 200 }, following: false });
  });

  it("ignores a rectangle that is too small to be a deliberate selection", () => {
    const rect = { left: 10, top: 10, width: 2, height: 2 };
    expect(frameRectangle(FOLLOWING, { width: 800, height: 480 }, rect)).toBe(FOLLOWING);
  });

  it("applies a camera change verbatim when follow is off", () => {
    const off: CameraFollow = { camera: CAMERA, following: false };
    const panned = { ...CAMERA, centreX: 1_200 };
    expect(applyCameraChange(off, panned, AT)).toEqual({ camera: panned, following: false });
  });
});
