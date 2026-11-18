import { describe, expect, it } from "vite-plus/test";
import { TACTICAL_MAX_M_PER_PX, TACTICAL_MIN_M_PER_PX } from "../../tactical-map/tacticalScale.js";
import {
  screenToWorld,
  worldToScreen,
  type TacticalCamera,
  type TacticalViewport,
} from "./tactical-geometry.js";
import {
  MIN_RECTANGLE_PIXELS,
  isUsableRectangle,
  rectangleCamera,
  rectangleFromCorners,
} from "./tactical-rectangle.js";

const VIEWPORT: TacticalViewport = { width: 800, height: 480 };
const CAMERA: TacticalCamera = { centreX: 2_000_000, centreY: -3_000_000, metresPerPixel: 400 };

describe("rectangleFromCorners", () => {
  it("normalises corners dragged in any direction", () => {
    const expected = { left: 100, top: 50, width: 200, height: 120 };
    expect(rectangleFromCorners([100, 50], [300, 170])).toEqual(expected);
    expect(rectangleFromCorners([300, 170], [100, 50])).toEqual(expected);
    expect(rectangleFromCorners([300, 50], [100, 170])).toEqual(expected);
    expect(rectangleFromCorners([100, 170], [300, 50])).toEqual(expected);
  });
});

describe("isUsableRectangle", () => {
  it("rejects a rectangle thinner than the minimum on either side", () => {
    const side = MIN_RECTANGLE_PIXELS;
    expect(isUsableRectangle({ left: 0, top: 0, width: side, height: side })).toBe(true);
    expect(isUsableRectangle({ left: 0, top: 0, width: side - 1, height: 200 })).toBe(false);
    expect(isUsableRectangle({ left: 0, top: 0, width: 200, height: side - 1 })).toBe(false);
  });
});

describe("rectangleCamera", () => {
  it("halves the scale and keeps the centre for a half-size rectangle in the middle", () => {
    const next = rectangleCamera(CAMERA, VIEWPORT, {
      left: 200,
      top: 120,
      width: 400,
      height: 240,
    });
    expect(next).toEqual({ ...CAMERA, metresPerPixel: 200 });
  });

  it("centres on the rectangle, not the screen", () => {
    const rect = { left: 600, top: 40, width: 100, height: 60 };
    const next = rectangleCamera(CAMERA, VIEWPORT, rect);
    const wanted = screenToWorld(CAMERA, VIEWPORT, [650, 70]);
    expect(next.centreX).toBe(Math.round(wanted[0]));
    expect(next.centreY).toBe(Math.round(wanted[1]));
  });

  it("fits the longer side of the rectangle into the viewport", () => {
    const wide = rectangleCamera(CAMERA, VIEWPORT, { left: 0, top: 0, width: 400, height: 48 });
    expect(wide.metresPerPixel).toBe(200);
    const tall = rectangleCamera(CAMERA, VIEWPORT, { left: 0, top: 0, width: 80, height: 240 });
    expect(tall.metresPerPixel).toBe(200);
  });

  it("keeps the whole rectangle on screen after the zoom", () => {
    const rect = { left: 150, top: 90, width: 233, height: 177 };
    const next = rectangleCamera(CAMERA, VIEWPORT, rect);
    const corners = [
      [rect.left, rect.top],
      [rect.left + rect.width, rect.top + rect.height],
    ] as const;
    for (const corner of corners) {
      const [x, y] = worldToScreen(next, VIEWPORT, screenToWorld(CAMERA, VIEWPORT, corner));
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(VIEWPORT.width + 1);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(y).toBeLessThanOrEqual(VIEWPORT.height + 1);
    }
  });

  it("clamps to the closest allowed zoom", () => {
    const tight = rectangleCamera(CAMERA, VIEWPORT, { left: 390, top: 230, width: 20, height: 20 });
    expect(tight.metresPerPixel).toBe(TACTICAL_MIN_M_PER_PX);
  });

  it("clamps to the widest allowed zoom", () => {
    const wide: TacticalCamera = { ...CAMERA, metresPerPixel: TACTICAL_MAX_M_PER_PX };
    const next = rectangleCamera(wide, VIEWPORT, { left: 0, top: 0, width: 800, height: 480 });
    expect(next.metresPerPixel).toBe(TACTICAL_MAX_M_PER_PX);
  });

  it("is a pure function of its inputs", () => {
    const rect = { left: 10, top: 20, width: 300, height: 200 };
    expect(rectangleCamera(CAMERA, VIEWPORT, rect)).toEqual(
      rectangleCamera(CAMERA, VIEWPORT, rect),
    );
  });
});
