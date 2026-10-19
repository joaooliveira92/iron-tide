import { describe, expect, it } from "vite-plus/test";
import { EDGES } from "./fixture-world.js";
import { buildLanes } from "./map-lanes.js";
import { projectAreas, projectionById } from "./projection.js";
import { AREAS } from "./fixture-world.js";

const projection = projectionById("miller");
const areas = projectAreas(AREAS, projection, 0);
const anchors = new Map(areas.map((area) => [area.id, area.label] as const));

describe("buildLanes", () => {
  it("draws one lane per ungated edge of the authoritative graph, and no others", () => {
    const lanes = buildLanes(EDGES, anchors, projection.width);
    const expected = new Set(
      EDGES.filter((edge) => edge.passage === undefined).map((edge) =>
        [edge.a, edge.b].sort().join("~"),
      ),
    );
    expect(new Set(lanes.map((lane) => lane.id))).toEqual(expected);
    expect(lanes).toHaveLength(expected.size);
  });

  it("leaves gated edges to the passage layer, which styles open and closed straits", () => {
    const gated = EDGES.filter((edge) => edge.passage !== undefined);
    expect(gated.length).toBeGreaterThan(0);
    const lanes = buildLanes(EDGES, anchors, projection.width);
    for (const edge of gated) {
      expect(lanes.some((lane) => lane.id === [edge.a, edge.b].sort().join("~"))).toBe(false);
    }
  });

  it("is deterministic: the same inputs give the same lanes in the same order", () => {
    const first = buildLanes(EDGES, anchors, projection.width);
    const second = buildLanes([...EDGES].reverse(), anchors, projection.width);
    expect(second.map((lane) => lane.id)).toEqual(first.map((lane) => lane.id));
    expect(buildLanes(EDGES, anchors, projection.width)).toEqual(first);
  });

  it("deduplicates an edge authored in both directions", () => {
    const lanes = buildLanes(
      [
        { a: "p", b: "q" },
        { a: "q", b: "p" },
      ],
      new Map([
        ["p", [10, 10] as const],
        ["q", [50, 30] as const],
      ]),
      1000,
    );
    expect(lanes).toHaveLength(1);
  });

  it("skips an edge whose end has no geometry rather than guessing a point", () => {
    const lanes = buildLanes([{ a: "p", b: "ghost" }], new Map([["p", [1, 1] as const]]), 1000);
    expect(lanes).toEqual([]);
  });

  it("takes the short way round the antimeridian instead of crossing the whole map", () => {
    const [lane] = buildLanes(
      [{ a: "east", b: "west" }],
      new Map([
        ["east", [980, 100] as const],
        ["west", [30, 120] as const],
      ]),
      1000,
    );
    expect(lane).toBeDefined();
    expect(Math.abs(lane!.to[0] - lane!.from[0])).toBeLessThan(500);
  });

  it("emits every lane with finite endpoints", () => {
    for (const lane of buildLanes(EDGES, anchors, projection.width)) {
      expect([...lane.from, ...lane.to].every(Number.isFinite)).toBe(true);
    }
  });
});
