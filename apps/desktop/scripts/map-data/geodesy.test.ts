import { describe, expect, it } from "vite-plus/test";

import {
  densifyEdgeAcrossAntimeridian,
  densifyRingLonLat,
  distanceToPolylineMetres,
  metresBetween,
  shortestLongitudeDelta,
  wrapLongitude,
  type Position,
} from "./geodesy.ts";
import { maxEdgeDeviationMetres } from "../../src/renderer/components/globe-spike/densify.ts";

const TOLERANCE = 25;

describe("edge semantics and densification", () => {
  it("wraps longitudes and picks the shortest way across the antimeridian", () => {
    expect(wrapLongitude(190)).toBeCloseTo(-170, 12);
    expect(wrapLongitude(-190)).toBeCloseTo(170, 12);
    expect(shortestLongitudeDelta(179.9, -179.9)).toBeCloseTo(0.2, 9);
    expect(shortestLongitudeDelta(-179.9, 179.9)).toBeCloseTo(-0.2, 9);
  });

  it("densifies an equatorial edge to the endpoints only", () => {
    expect(densifyEdgeAcrossAntimeridian([10, 0], [12, 0], TOLERANCE)).toEqual([
      [10, 0],
      [12, 0],
    ]);
  });

  it("splits a high-latitude edge and keeps every vertex within tolerance of the lon/lat line", () => {
    const from: Position = [10, 70];
    const to: Position = [14, 84];
    const points = densifyEdgeAcrossAntimeridian(from, to, TOLERANCE);
    expect(points.length).toBeGreaterThan(20);
    expect(points[0]).toEqual(from);
    expect(points[points.length - 1]).toEqual(to);
    for (let index = 0; index + 1 < points.length; index++) {
      const a = points[index] as Position;
      const b = points[index + 1] as Position;
      expect(maxEdgeDeviationMetres(a, b)).toBeLessThanOrEqual(TOLERANCE * 1.01);
    }
  });

  it("crosses the antimeridian the short way with wrapped longitudes", () => {
    const points = densifyEdgeAcrossAntimeridian([179.9, 40], [-179.9, 60], TOLERANCE);
    expect(points[0]).toEqual([179.9, 40]);
    expect(points[points.length - 1]).toEqual([-179.9, 60]);
    for (const point of points) expect(Math.abs(point[0])).toBeGreaterThan(179.89);
    for (let index = 0; index + 1 < points.length; index++) {
      expect(metresBetween(points[index] as Position, points[index + 1] as Position)).toBeLessThan(
        200000,
      );
    }
  });

  it("returns identical vertices for an edge and its reverse, including across the antimeridian", () => {
    for (const [a, b] of [
      [
        [-62, -55],
        [-70, -25],
      ],
      [
        [179.9, 40],
        [-179.9, 60],
      ],
      [
        [10, 70],
        [14, 84],
      ],
    ] as const) {
      const forward = densifyEdgeAcrossAntimeridian(a, b, TOLERANCE);
      const backward = densifyEdgeAcrossAntimeridian(b, a, TOLERANCE);
      expect([...backward].reverse()).toEqual(forward);
    }
  });

  it("is stable under repeated processing and does not grow unboundedly", () => {
    const ring: Position[] = [
      [20, 60],
      [40, 60],
      [40, 80],
      [20, 80],
      [20, 60],
    ];
    const once = densifyRingLonLat(ring, TOLERANCE);
    const twice = densifyRingLonLat(once, TOLERANCE);
    expect(twice).toEqual(once);
    expect(once.length).toBeLessThan(2000);
  });

  it("keeps a narrow channel edge identical when two polygons share it", () => {
    const west: Position[] = [
      [0, 40],
      [1.5, 55],
      [-2, 55],
      [-2, 40],
      [0, 40],
    ];
    const east: Position[] = [
      [0, 40],
      [3, 40],
      [3, 55],
      [1.5, 55],
      [0, 40],
    ];
    const westEdge = densifyEdgeAcrossAntimeridian(
      west[0] as Position,
      west[1] as Position,
      TOLERANCE,
    );
    const eastEdge = densifyEdgeAcrossAntimeridian(
      east[3] as Position,
      east[4] as Position,
      TOLERANCE,
    );
    expect([...eastEdge].reverse()).toEqual(westEdge);
    expect(westEdge.every((point) => distanceToPolylineMetres(point, westEdge) < 1e-6)).toBe(true);
  });
});
