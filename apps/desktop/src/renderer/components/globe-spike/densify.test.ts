import { describe, expect, it } from "vite-plus/test";

import {
  densifyEdge,
  densifyRing,
  edgeSplitCount,
  maxEdgeDeviationMetres,
  type Position,
} from "./densify.js";

const BARENTS: Position = [70, 72];
const BARENTS_NORTH: Position = [70, 84];
const SOUTH_ATLANTIC: readonly Position[] = [
  [-60, 8],
  [-16, 8],
  [8, -20],
  [12, -32],
  [-15, -55],
  [-62, -55],
  [-70, -25],
  [-60, 8],
];

describe("edge densification", () => {
  it("keeps the endpoints exactly", () => {
    const points = densifyEdge(BARENTS, BARENTS_NORTH, 10);
    expect(points[0]).toEqual(BARENTS);
    expect(points[points.length - 1]).toEqual(BARENTS_NORTH);
  });

  it("returns identical points for an edge and its reverse (shared-edge identity)", () => {
    const forward = densifyEdge([-62, -55], [-70, -25], 10);
    const backward = densifyEdge([-70, -25], [-62, -55], 10);
    expect([...backward].reverse()).toEqual(forward);
  });

  it("is deterministic across repeated runs", () => {
    expect(densifyRing(SOUTH_ATLANTIC, 10)).toEqual(densifyRing(SOUTH_ATLANTIC, 10));
  });

  it("uses a single segment when the edge cannot deviate beyond tolerance", () => {
    expect(edgeSplitCount([0, 10], [30, 10], 1)).toBe(1);
  });

  it("grows the segment count as the tolerance tightens", () => {
    const loose = edgeSplitCount(BARENTS, BARENTS_NORTH, 1000);
    const tight = edgeSplitCount(BARENTS, BARENTS_NORTH, 10);
    expect(tight).toBeGreaterThan(loose);
  });

  it("keeps the densified polyline within tolerance of the lon/lat-linear edge", () => {
    const toleranceMetres = 50;
    const points = densifyEdge([-62, -55], [-70, -25], toleranceMetres);
    for (let index = 0; index + 1 < points.length; index++) {
      const a = points[index] as Position;
      const b = points[index + 1] as Position;
      expect(maxEdgeDeviationMetres(a, b)).toBeLessThan(toleranceMetres * 4);
    }
  });

  it("measures the whole-edge Mercator versus lon/lat deviation recorded in the investigation", () => {
    expect(maxEdgeDeviationMetres([-62, -55], [-70, -25]) / 1000).toBeGreaterThan(150);
    expect(maxEdgeDeviationMetres([70, 72], [70, 84]) / 1000).toBeGreaterThan(150);
    expect(maxEdgeDeviationMetres([0, 10], [30, 10])).toBeLessThan(1e-6);
  });

  it("preserves ring closure and vertex continuity", () => {
    const ring = densifyRing(SOUTH_ATLANTIC, 100);
    expect(ring[0]).toEqual(SOUTH_ATLANTIC[0]);
    expect(ring[ring.length - 1]).toEqual(SOUTH_ATLANTIC[SOUTH_ATLANTIC.length - 1]);
    for (const vertex of SOUTH_ATLANTIC) expect(ring).toContainEqual(vertex);
  });
});
