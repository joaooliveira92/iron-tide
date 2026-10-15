import { describe, expect, it } from "vite-plus/test";
import {
  clamp,
  finiteOr,
  lerp,
  type PathSegment,
  pathPoints,
  type Point,
  polygonPoints,
  samplePath,
  serializePath,
} from "./path.js";

const seg: PathSegment[] = [
  { kind: "M", to: { x: 1, y: 2 } },
  { kind: "L", to: { x: 3, y: 4 } },
  { kind: "Q", control: { x: 5, y: 6 }, to: { x: 7, y: 8 } },
  { kind: "C", c1: { x: 9, y: 10 }, c2: { x: 11, y: 12 }, to: { x: 13, y: 14 } },
  { kind: "Z" },
];

describe("serializePath", () => {
  it("writes each command with coordinates fixed to two decimals, joined by spaces", () => {
    expect(serializePath([{ kind: "M", to: { x: 1, y: 2 } }])).toBe("M 1.00 2.00");
    expect(
      serializePath([
        { kind: "M", to: { x: 0, y: 0 } },
        { kind: "L", to: { x: 3.14159, y: -2 } },
        { kind: "Q", control: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
        { kind: "C", c1: { x: 0, y: 0 }, c2: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
        { kind: "Z" },
      ]),
    ).toBe("M 0.00 0.00 L 3.14 -2.00 Q 1.00 1.00 2.00 2.00 C 0.00 0.00 1.00 1.00 2.00 2.00 Z");
  });

  it("serialises an empty path to the empty string", () => {
    expect(serializePath([])).toBe("");
  });
});

describe("pathPoints", () => {
  it("returns the vertices and every control point, skipping Z", () => {
    expect(pathPoints(seg)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
      { x: 9, y: 10 },
      { x: 11, y: 12 },
      { x: 13, y: 14 },
    ]);
  });
});

describe("lerp", () => {
  it("interpolates between two points, including past the ends", () => {
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: -10 }, 0.25)).toEqual({ x: 2.5, y: -2.5 });
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: 0 }, 2)).toEqual({ x: 20, y: 0 });
  });
});

describe("clamp", () => {
  it("bounds a value into [lo, hi]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("finiteOr", () => {
  it("keeps finite values and replaces NaN and infinities", () => {
    expect(finiteOr(3.5, 0)).toBe(3.5);
    expect(finiteOr(Number.NaN, 7)).toBe(7);
    expect(finiteOr(Number.POSITIVE_INFINITY, 7)).toBe(7);
    expect(finiteOr(Number.NEGATIVE_INFINITY, 7)).toBe(7);
  });
});

describe("samplePath", () => {
  it("emits a point per M/L and `steps` points per curved segment", () => {
    const pts = samplePath(
      [
        { kind: "M", to: { x: 0, y: 0 } },
        { kind: "L", to: { x: 10, y: 0 } },
        { kind: "Q", control: { x: 15, y: 10 }, to: { x: 20, y: 0 } },
      ],
      4,
    );
    expect(pts).toHaveLength(1 + 1 + 4);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 10, y: 0 });
    expect(pts.at(-1)).toEqual({ x: 20, y: 0 });
  });

  it("a curved segment without a preceding move is skipped", () => {
    expect(samplePath([{ kind: "Q", control: { x: 1, y: 1 }, to: { x: 2, y: 2 } }], 4)).toEqual([]);
  });

  it("a straight cubic stays on the line between its endpoints", () => {
    const pts = samplePath(
      [
        { kind: "M", to: { x: 0, y: 0 } },
        { kind: "C", c1: { x: 10, y: 0 }, c2: { x: 20, y: 0 }, to: { x: 30, y: 0 } },
      ],
      6,
    );
    for (const p of pts) expect(p.y).toBeCloseTo(0, 9);
    expect(pts.at(-1)).toEqual({ x: 30, y: 0 });
  });

  it("defaults to 24 steps per curved segment", () => {
    expect(
      samplePath([
        { kind: "M", to: { x: 0, y: 0 } },
        { kind: "Q", control: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
      ]),
    ).toHaveLength(25);
  });
});

describe("polygonPoints", () => {
  it("joins points as comma-separated pairs, fixed to two decimals", () => {
    const pts: Point[] = [
      { x: 1, y: 2 },
      { x: 3.456, y: 4 },
    ];
    expect(polygonPoints(pts)).toBe("1.00,2.00 3.46,4.00");
  });

  it("an empty polygon is the empty string", () => {
    expect(polygonPoints([])).toBe("");
  });
});
