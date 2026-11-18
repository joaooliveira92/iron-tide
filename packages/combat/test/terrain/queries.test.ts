import { describe, expect, it } from "vite-plus/test";
import {
  TERRAIN_QUERY_LIMIT_M,
  floorMetres,
  nearestCoastPoint,
  pointInLand,
  pointInNoGoZone,
  segmentCrossesLand,
  type Position,
  type TerrainView,
} from "@bluewave/combat/terrain";

const M = 1_000_000;

function at(xM: number, yM: number): Position {
  return [xM * M, yM * M];
}

const square = {
  id: "land_square",
  vertices: [
    { xM: 0, yM: 0 },
    { xM: 1000, yM: 0 },
    { xM: 1000, yM: 1000 },
    { xM: 0, yM: 1000 },
  ],
};

const lShape = {
  id: "land_l",
  vertices: [
    { xM: 5000, yM: 0 },
    { xM: 7000, yM: 0 },
    { xM: 7000, yM: 2000 },
    { xM: 6000, yM: 2000 },
    { xM: 6000, yM: 1000 },
    { xM: 5000, yM: 1000 },
  ],
};

const terrain: TerrainView = {
  land: [square, lShape],
  shallows: [
    {
      id: "shoal",
      vertices: [
        { xM: -500, yM: -500 },
        { xM: 0, yM: -500 },
        { xM: 0, yM: 0 },
        { xM: -500, yM: 0 },
      ],
    },
  ],
  exclusions: [{ id: "base_a", xM: 3000, yM: 3000, radiusM: 500 }],
};

const empty: TerrainView = { land: [], shallows: [], exclusions: [] };

describe("floorMetres", () => {
  it("floors toward negative infinity", () => {
    expect(floorMetres(0)).toBe(0);
    expect(floorMetres(999_999)).toBe(0);
    expect(floorMetres(1_000_000)).toBe(1);
    expect(floorMetres(-1)).toBe(-1);
    expect(floorMetres(-1_000_000)).toBe(-1);
    expect(floorMetres(-1_000_001)).toBe(-2);
  });

  it("stays exact beyond the float-division safe range", () => {
    expect(floorMetres(Number.MAX_SAFE_INTEGER)).toBe(9_007_199_254);
    expect(floorMetres(-Number.MAX_SAFE_INTEGER)).toBe(-9_007_199_255);
    expect(floorMetres(9_007_199_254_000_000 - 1)).toBe(9_007_199_253);
  });

  it("rejects non-integer and unsafe positions", () => {
    expect(() => floorMetres(0.5)).toThrow();
    expect(() => floorMetres(Number.NaN)).toThrow();
    expect(() => floorMetres(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe("pointInLand", () => {
  it("is true inside and false outside", () => {
    expect(pointInLand(terrain, at(500, 500))).toBe(true);
    expect(pointInLand(terrain, at(1500, 500))).toBe(false);
    expect(pointInLand(terrain, at(-1, 500))).toBe(false);
  });

  it("counts the boundary and vertices as land", () => {
    expect(pointInLand(terrain, at(0, 500))).toBe(true);
    expect(pointInLand(terrain, at(1000, 1000))).toBe(true);
    expect(pointInLand(terrain, at(500, 0))).toBe(true);
  });

  it("floors sub-metre positions before testing", () => {
    expect(pointInLand(terrain, [1_000_000_000, 500_000_000])).toBe(true);
    expect(pointInLand(terrain, [1_000_999_999, 500_000_000])).toBe(true);
    expect(pointInLand(terrain, [1_001_000_000, 500_000_000])).toBe(false);
    expect(pointInLand(terrain, [-1, 500_000_000])).toBe(false);
    expect(pointInLand(terrain, [999_999_999, 999_999_999])).toBe(true);
  });

  it("handles concave polygons", () => {
    expect(pointInLand(terrain, at(5500, 500))).toBe(true);
    expect(pointInLand(terrain, at(6500, 1500))).toBe(true);
    expect(pointInLand(terrain, at(5500, 1500))).toBe(false);
  });

  it("does not treat shallows as land", () => {
    expect(pointInLand(terrain, at(-250, -250))).toBe(false);
  });

  it("is false for empty terrain at any distance", () => {
    expect(pointInLand(empty, at(0, 0))).toBe(false);
    expect(pointInLand(empty, [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])).toBe(false);
  });

  it("answers false for far positions without arithmetic overflow", () => {
    expect(pointInLand(terrain, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])).toBe(false);
    expect(pointInLand(terrain, [-Number.MAX_SAFE_INTEGER, 0])).toBe(false);
  });

  it("rejects non-safe-integer positions", () => {
    expect(() => pointInLand(terrain, [Number.MAX_SAFE_INTEGER + 1, 0])).toThrow();
    expect(() => pointInLand(terrain, [0, 0.5])).toThrow();
  });
});

describe("pointInNoGoZone", () => {
  it("covers land and exclusion circles but not shallows", () => {
    expect(pointInNoGoZone(terrain, at(500, 500))).toBe(true);
    expect(pointInNoGoZone(terrain, at(3000, 3000))).toBe(true);
    expect(pointInNoGoZone(terrain, at(3500, 3000))).toBe(true);
    expect(pointInNoGoZone(terrain, at(3501, 3000))).toBe(false);
    expect(pointInNoGoZone(terrain, at(-250, -250))).toBe(false);
    expect(pointInNoGoZone(terrain, at(9000, 9000))).toBe(false);
  });

  it("uses the floored metre position against the circle", () => {
    expect(pointInNoGoZone(terrain, [3_500_999_999, 3_000_000_000])).toBe(true);
    expect(pointInNoGoZone(terrain, [3_501_000_000, 3_000_000_000])).toBe(false);
    expect(pointInNoGoZone(terrain, [2_499_999_999, 3_000_000_000])).toBe(false);
  });

  it("handles far positions without overflow", () => {
    expect(pointInNoGoZone(terrain, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])).toBe(
      false,
    );
    expect(pointInNoGoZone(empty, [Number.MAX_SAFE_INTEGER, 0])).toBe(false);
  });
});

describe("segmentCrossesLand", () => {
  it("is true when the segment cuts through land", () => {
    expect(segmentCrossesLand(terrain, at(-100, 500), at(1100, 500))).toBe(true);
  });

  it("is true when an endpoint is inside land or the segment lies wholly inside", () => {
    expect(segmentCrossesLand(terrain, at(-100, 500), at(500, 500))).toBe(true);
    expect(segmentCrossesLand(terrain, at(100, 100), at(900, 900))).toBe(true);
  });

  it("is false for clear water and for passing a concave notch", () => {
    expect(segmentCrossesLand(terrain, at(-100, -100), at(1100, -100))).toBe(false);
    expect(segmentCrossesLand(terrain, at(5100, 1500), at(5900, 1500))).toBe(false);
    expect(segmentCrossesLand(terrain, at(5100, 1500), at(6500, 1500))).toBe(true);
  });

  it("counts touching an edge or a vertex as a crossing", () => {
    expect(segmentCrossesLand(terrain, at(-100, 1000), at(1100, 1000))).toBe(true);
    expect(segmentCrossesLand(terrain, at(-100, -100), at(100, 100))).toBe(true);
    expect(segmentCrossesLand(terrain, at(-500, 0), at(0, -500))).toBe(false);
  });

  it("treats a degenerate segment as a point query", () => {
    expect(segmentCrossesLand(terrain, at(500, 500), at(500, 500))).toBe(true);
    expect(segmentCrossesLand(terrain, at(2000, 2000), at(2000, 2000))).toBe(false);
  });

  it("ignores shallows and exclusion circles", () => {
    expect(segmentCrossesLand(terrain, at(-600, -250), at(-100, -250))).toBe(false);
    expect(segmentCrossesLand(terrain, at(2000, 3000), at(4000, 3000))).toBe(false);
  });

  it("is false against empty terrain even for extreme endpoints", () => {
    expect(
      segmentCrossesLand(
        empty,
        [-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      ),
    ).toBe(false);
  });

  it("answers extreme endpoints without overflow when the segment misses land", () => {
    expect(
      segmentCrossesLand(
        terrain,
        [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER],
      ),
    ).toBe(false);
  });

  it("rejects unsafe endpoints", () => {
    expect(() => segmentCrossesLand(terrain, [0, 0], [Number.MAX_SAFE_INTEGER + 1, 0])).toThrow();
  });
});

describe("nearestCoastPoint", () => {
  it("is undefined without land", () => {
    expect(nearestCoastPoint(empty, at(0, 0))).toBeUndefined();
  });

  it("finds the nearest point on an edge", () => {
    expect(nearestCoastPoint(terrain, at(500, -300))).toEqual({
      polygonId: "land_square",
      edgeIndex: 0,
      xM: 500,
      yM: 0,
      distanceSquaredM: 90_000,
    });
  });

  it("clamps to a vertex beyond an edge end", () => {
    expect(nearestCoastPoint(terrain, at(-30, -40))).toEqual({
      polygonId: "land_square",
      edgeIndex: 0,
      xM: 0,
      yM: 0,
      distanceSquaredM: 2_500,
    });
  });

  it("breaks ties by lowest polygon then lowest edge index", () => {
    const hit = nearestCoastPoint(terrain, at(500, 500));
    expect(hit).toMatchObject({ polygonId: "land_square", edgeIndex: 0, xM: 500, yM: 0 });
    expect(hit?.distanceSquaredM).toBe(250_000);
  });

  it("breaks a vertex tie at a shared vertex to the lower edge index", () => {
    const hit = nearestCoastPoint(terrain, at(-100, -100));
    expect(hit).toMatchObject({ polygonId: "land_square", edgeIndex: 0, xM: 0, yM: 0 });
  });

  it("returns a point inside the polygon's own edge span for sloped edges", () => {
    const tri: TerrainView = {
      land: [
        {
          id: "tri",
          vertices: [
            { xM: 0, yM: 0 },
            { xM: 1000, yM: 0 },
            { xM: 0, yM: 1000 },
          ],
        },
      ],
      shallows: [],
      exclusions: [],
    };
    const hit = nearestCoastPoint(tri, at(1000, 1000));
    expect(hit).toMatchObject({ edgeIndex: 1, xM: 500, yM: 500, distanceSquaredM: 500_000 });
  });

  it("works at the query limit without overflow", () => {
    const hit = nearestCoastPoint(terrain, at(TERRAIN_QUERY_LIMIT_M, TERRAIN_QUERY_LIMIT_M));
    expect(hit).toBeDefined();
    expect(Number.isSafeInteger(hit?.distanceSquaredM)).toBe(true);
  });

  it("rejects positions beyond the query limit and unsafe positions", () => {
    expect(() => nearestCoastPoint(terrain, at(TERRAIN_QUERY_LIMIT_M + 1, 0))).toThrow();
    expect(() => nearestCoastPoint(terrain, [Number.MAX_SAFE_INTEGER, 0])).toThrow();
    expect(() => nearestCoastPoint(terrain, [0.5, 0])).toThrow();
  });
});
