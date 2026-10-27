import { describe, expect, it } from "vite-plus/test";

import { distanceToPolylineMetres, type Position } from "./geodesy.ts";
import { densifyEdge } from "../../src/renderer/components/globe-spike/densify.ts";
import { AREAS } from "../../src/renderer/components/world-map/map-geometry.ts";

const TOLERANCE_METRES = 10;

interface Edge {
  readonly area: string;
  readonly from: Position;
  readonly to: Position;
}

const EDGES: readonly Edge[] = AREAS.flatMap((area) => {
  const ring: Position[] = [...area.ring];
  const first = ring[0] as Position;
  const last = ring[ring.length - 1] as Position;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  const edges: Edge[] = [];
  for (let index = 0; index + 1 < ring.length; index++) {
    edges.push({ area: area.id, from: ring[index] as Position, to: ring[index + 1] as Position });
  }
  return edges;
});

function cross(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function overlapSpan(a: Edge, b: Edge): readonly [number, number] | null {
  if (Math.abs(cross(a.from, a.to, b.from)) > 1e-9 || Math.abs(cross(a.from, a.to, b.to)) > 1e-9)
    return null;
  const horizontal = Math.abs(a.to[0] - a.from[0]) >= Math.abs(a.to[1] - a.from[1]);
  const axis: 0 | 1 = horizontal ? 0 : 1;
  const aLow = Math.min(a.from[axis], a.to[axis]);
  const aHigh = Math.max(a.from[axis], a.to[axis]);
  const bLow = Math.min(b.from[axis], b.to[axis]);
  const bHigh = Math.max(b.from[axis], b.to[axis]);
  const low = Math.max(aLow, bLow);
  const high = Math.min(aHigh, bHigh);
  return high - low > 1e-9 ? [low, high] : null;
}

function within(point: Position, span: readonly [number, number], axis: 0 | 1): boolean {
  return point[axis] >= span[0] - 1e-9 && point[axis] <= span[1] + 1e-9;
}

interface SharedPair {
  readonly a: Edge;
  readonly b: Edge;
  readonly span: readonly [number, number];
  readonly axis: 0 | 1;
}

function sharedPairs(): SharedPair[] {
  const pairs: SharedPair[] = [];
  for (let i = 0; i < EDGES.length; i++) {
    for (let j = i + 1; j < EDGES.length; j++) {
      const a = EDGES[i] as Edge;
      const b = EDGES[j] as Edge;
      if (a.area === b.area) continue;
      const span = overlapSpan(a, b);
      if (span === null) continue;
      const axis: 0 | 1 = Math.abs(a.to[0] - a.from[0]) >= Math.abs(a.to[1] - a.from[1]) ? 0 : 1;
      pairs.push({ a, b, span, axis });
    }
  }
  return pairs;
}

describe("neighbouring area outlines after densification", () => {
  const pairs = sharedPairs();

  it("finds the shared boundaries the test depends on", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    expect(
      new Set(pairs.flatMap((pair) => [pair.a.area, pair.b.area])).size,
    ).toBeGreaterThanOrEqual(8);
  });

  it("opens no crack wider than the densification tolerance along any shared span", () => {
    let worst = 0;
    for (const { a, b, span, axis } of pairs) {
      const chainA = densifyEdge(a.from, a.to, TOLERANCE_METRES);
      const chainB = densifyEdge(b.from, b.to, TOLERANCE_METRES);
      for (const point of chainA) {
        if (within(point, span, axis))
          worst = Math.max(worst, distanceToPolylineMetres(point, chainB));
      }
      for (const point of chainB) {
        if (within(point, span, axis))
          worst = Math.max(worst, distanceToPolylineMetres(point, chainA));
      }
    }
    expect(worst).toBeLessThanOrEqual(TOLERANCE_METRES);
  });

  it("has no exactly shared edge today, so partial overlaps are the only boundaries to protect", () => {
    const exact = pairs.filter(({ a, b }) => {
      const reversed =
        a.from[0] === b.to[0] &&
        a.from[1] === b.to[1] &&
        a.to[0] === b.from[0] &&
        a.to[1] === b.from[1];
      const parallel =
        a.from[0] === b.from[0] &&
        a.from[1] === b.from[1] &&
        a.to[0] === b.to[0] &&
        a.to[1] === b.to[1];
      return reversed || parallel;
    });
    expect(exact).toHaveLength(0);
  });

  it("keeps every densified vertex on its original lon/lat edge", () => {
    for (const edge of EDGES) {
      for (const point of densifyEdge(edge.from, edge.to, TOLERANCE_METRES)) {
        expect(Math.abs(cross(edge.from, edge.to, point))).toBeLessThan(1e-9);
      }
    }
  });
});
