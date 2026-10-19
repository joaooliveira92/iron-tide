import { describe, expect, it } from "vite-plus/test";
import { PLAN_MID } from "./geometry.js";
import { armourShape, regionPath, stripPath } from "./armour-plan.js";
import { frame } from "./test-fixtures.js";

const coords = (d: string) =>
  d
    .replace(/[MZ]/g, " ")
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number) as [number, number]);

describe("armour plan geometry", () => {
  it("bounds a strip by its station range and keeps it on the hull side of the deck edge", () => {
    const pts = coords(stripPath(frame, 300, 700, 1, 0.8));
    const xs = pts.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(frame.x(300), 1);
    expect(Math.max(...xs)).toBeCloseTo(frame.x(700), 1);
    // Every point lies within the hull's half-beam at its station.
    for (const [x, y] of pts)
      expect(Math.abs(y - PLAN_MID)).toBeLessThanOrEqual(frame.maxHalf + 0.01);
  });

  it("draws a strip on both sides of the centreline", () => {
    const ys = coords(stripPath(frame, 300, 700, 1, 0.8)).map(([, y]) => y);
    expect(ys.some((y) => y < PLAN_MID)).toBe(true);
    expect(ys.some((y) => y > PLAN_MID)).toBe(true);
  });

  it("narrows the inner region with its scale and follows the hull's taper", () => {
    const wide = coords(regionPath(frame, 0, 1000, 0.9));
    const narrow = coords(regionPath(frame, 0, 1000, 0.5));
    const span = (pts: [number, number][]) =>
      Math.max(...pts.map(([, y]) => y)) - Math.min(...pts.map(([, y]) => y));
    expect(span(narrow)).toBeLessThan(span(wide));
    const first = wide[0]!;
    const mid = wide.find(([x]) => Math.abs(x - frame.x(500)) < 1)!;
    expect(Math.abs(first[1] - PLAN_MID)).toBeLessThan(Math.abs(mid[1] - PLAN_MID));
  });

  it("classes each armour region as belt strip, deck, or the whole inner hull", () => {
    expect(armourShape("BELT_MAIN")).toBe("strip");
    expect(armourShape("BELT_UPPER")).toBe("strip");
    expect(armourShape("DECK_MAIN")).toBe("deck");
    expect(armourShape("DECK_SLOPE")).toBe("deck");
    expect(armourShape("TURRET")).toBe("inner");
    expect(armourShape("CONNING_TOWER")).toBe("inner");
  });
});
