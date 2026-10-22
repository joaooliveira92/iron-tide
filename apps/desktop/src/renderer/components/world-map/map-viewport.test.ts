import { describe, expect, it } from "vite-plus/test";
import { minimapToWorld, visibleWorldRects } from "./map-viewport.js";

const WORLD = { width: 1000, height: 500 };
const VIEW = { width: 1000, height: 500 };

describe("visibleWorldRects", () => {
  it("covers the whole world at scale 1", () => {
    expect(visibleWorldRects({ scale: 1, x: 0, y: 0 }, VIEW, WORLD)).toEqual([
      { x: 0, y: 0, width: 1000, height: 500 },
    ]);
  });

  it("shrinks with zoom and follows the pan", () => {
    expect(visibleWorldRects({ scale: 4, x: -1600, y: -400 }, VIEW, WORLD)).toEqual([
      { x: 400, y: 100, width: 250, height: 125 },
    ]);
  });

  it("returns two rectangles when the view straddles the antimeridian", () => {
    const rects = visibleWorldRects({ scale: 4, x: -3800, y: 0 }, VIEW, WORLD);
    expect(rects).toEqual([
      { x: 950, y: 0, width: 250, height: 125 },
      { x: -50, y: 0, width: 250, height: 125 },
    ]);
  });

  it("wraps negative pans into the world and keeps the rectangle inside vertically", () => {
    const [rect] = visibleWorldRects({ scale: 2, x: 200, y: -9999 }, VIEW, WORLD);
    expect(rect?.x).toBe(900);
    expect(rect?.y).toBe(250);
  });
});

describe("minimapToWorld", () => {
  it("maps fractions to world coordinates and clamps", () => {
    expect(minimapToWorld({ x: 0.5, y: 0.25 }, WORLD)).toEqual({ x: 500, y: 125 });
    expect(minimapToWorld({ x: -1, y: 2 }, WORLD)).toEqual({ x: 0, y: 500 });
  });
});
