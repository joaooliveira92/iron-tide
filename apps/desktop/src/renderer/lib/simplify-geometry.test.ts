import { describe, expect, it } from "vite-plus/test";
import { simplifyRing, simplifyPolygons } from "./simplify-geometry.js";

describe("simplifyRing (Douglas–Peucker over flat [x,y,...])", () => {
  it("drops collinear points and keeps endpoints", () => {
    const ring = [0, 0, 1, 0, 2, 0, 3, 0, 3, 3];
    expect(simplifyRing(ring, 0.01)).toEqual([0, 0, 3, 0, 3, 3]);
  });

  it("keeps a point that deviates more than the tolerance", () => {
    const ring = [0, 0, 1, 1, 2, 0];
    expect(simplifyRing(ring, 0.5)).toEqual([0, 0, 1, 1, 2, 0]);
    expect(simplifyRing(ring, 1.5)).toEqual([0, 0, 2, 0]);
  });

  it("is deterministic and never returns fewer than 2 points", () => {
    const ring = [0, 0, 5, 5];
    expect(simplifyRing(ring, 100)).toEqual([0, 0, 5, 5]);
    expect(simplifyRing(ring, 100)).toEqual(simplifyRing(ring, 100));
  });
});

describe("simplifyPolygons", () => {
  it("drops rings that collapse below 4 points (3 vertices) but never the exterior ring's polygon entirely when large", () => {
    const tiny = [[[0, 0, 0.001, 0, 0.001, 0.001, 0, 0.001, 0, 0]]];
    expect(simplifyPolygons(tiny, 1)).toEqual([]);
    const square = [[[0, 0, 10, 0, 10, 10, 0, 10, 0, 0]]];
    expect(simplifyPolygons(square, 1)).toHaveLength(1);
  });
});
