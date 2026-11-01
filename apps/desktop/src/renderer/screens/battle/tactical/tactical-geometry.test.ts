import { describe, expect, it } from "vite-plus/test";
import {
  centreCameraOn,
  compassFromHeading,
  fitCamera,
  headingFromCompass,
  panCamera,
  screenToWorld,
  visibleLabelKeys,
  worldToScreen,
  zoomCameraAt,
  type TacticalCamera,
} from "./tactical-geometry.js";

const VIEWPORT = { width: 800, height: 600 };
const CAMERA: TacticalCamera = { centreX: 0, centreY: 0, metresPerPixel: 100 };

describe("compass conversion", () => {
  it("maps engine heading 90 to north and 0 to east", () => {
    expect(compassFromHeading(90)).toBe(0);
    expect(compassFromHeading(0)).toBe(90);
    expect(compassFromHeading(270)).toBe(180);
  });

  it("round-trips every whole degree", () => {
    for (let degrees = 0; degrees < 360; degrees += 1) {
      expect(headingFromCompass(compassFromHeading(degrees))).toBe(degrees);
      expect(compassFromHeading(degrees)).toBeGreaterThanOrEqual(0);
      expect(compassFromHeading(degrees)).toBeLessThan(360);
    }
  });
});

describe("tactical camera", () => {
  it("draws north up and the centre at the middle of the viewport", () => {
    expect(worldToScreen(CAMERA, VIEWPORT, [0, 0])).toEqual([400, 300]);
    const north = worldToScreen(CAMERA, VIEWPORT, [0, 100_000_000]);
    expect(north[0]).toBe(400);
    expect(north[1]).toBeLessThan(300);
  });

  it("projects and unprojects to the same point", () => {
    const world: readonly [number, number] = [12_345_678_900, -9_876_543_210];
    const back = screenToWorld(CAMERA, VIEWPORT, worldToScreen(CAMERA, VIEWPORT, world));
    expect(Math.abs(back[0] - world[0])).toBeLessThan(2);
    expect(Math.abs(back[1] - world[1])).toBeLessThan(2);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const anchor: readonly [number, number] = [650, 120];
    const before = screenToWorld(CAMERA, VIEWPORT, anchor);
    const zoomed = zoomCameraAt(CAMERA, VIEWPORT, 2, anchor);
    const after = screenToWorld(zoomed, VIEWPORT, anchor);
    expect(zoomed.metresPerPixel).toBeLessThan(CAMERA.metresPerPixel);
    expect(Math.abs(after[0] - before[0])).toBeLessThan(2);
    expect(Math.abs(after[1] - before[1])).toBeLessThan(2);
  });

  it("clamps zoom to the tactical scale limits", () => {
    expect(zoomCameraAt(CAMERA, VIEWPORT, 1e9, [0, 0]).metresPerPixel).toBe(50);
    expect(zoomCameraAt(CAMERA, VIEWPORT, 1e-9, [0, 0]).metresPerPixel).toBe(1600);
  });

  it("pans so a dragged point follows the pointer", () => {
    const panned = panCamera(CAMERA, [40, -25]);
    const moved = worldToScreen(panned, VIEWPORT, [0, 0]);
    expect(moved[0]).toBeCloseTo(440, 5);
    expect(moved[1]).toBeCloseTo(275, 5);
  });

  it("centres on a point", () => {
    const centred = centreCameraOn(CAMERA, [5_000_000, 7_000_000]);
    expect(worldToScreen(centred, VIEWPORT, [5_000_000, 7_000_000])).toEqual([400, 300]);
  });

  it("fits every point inside the viewport", () => {
    const points: readonly (readonly [number, number])[] = [
      [-4_000_000_000, -1_000_000_000],
      [6_000_000_000, 2_000_000_000],
    ];
    const fitted = fitCamera(points, VIEWPORT, CAMERA);
    for (const point of points) {
      const [x, y] = worldToScreen(fitted, VIEWPORT, point);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(VIEWPORT.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(VIEWPORT.height);
    }
  });

  it("returns the fallback camera when nothing is known", () => {
    expect(fitCamera([], VIEWPORT, CAMERA)).toBe(CAMERA);
  });
});

describe("label placement", () => {
  const label = (key: string, priority: number, x: number) => ({
    key,
    priority,
    x,
    y: 0,
    width: 40,
    height: 10,
  });

  it("keeps the higher priority label when two collide", () => {
    const shown = visibleLabelKeys([label("low", 1, 0), label("high", 5, 10)]);
    expect([...shown]).toEqual(["high"]);
  });

  it("keeps both labels when they do not overlap", () => {
    expect(visibleLabelKeys([label("a", 1, 0), label("b", 1, 100)]).size).toBe(2);
  });

  it("breaks priority ties by key so the result never depends on input order", () => {
    const forward = visibleLabelKeys([label("a", 1, 0), label("b", 1, 10)]);
    const backward = visibleLabelKeys([label("b", 1, 10), label("a", 1, 0)]);
    expect([...forward]).toEqual([...backward]);
  });
});
