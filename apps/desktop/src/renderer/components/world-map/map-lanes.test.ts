import { describe, expect, it } from "vite-plus/test";
import { EDGES } from "./fixture-world.js";
import { buildLanes, laneEdges } from "./map-lanes.js";
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

describe("laneEdges", () => {
  it("falls back to the fixture graph when no campaign is loaded", () => {
    expect(laneEdges(null, EDGES)).toBe(EDGES);
  });

  it("uses the campaign's own connectivity when one is loaded, not the fixture's", () => {
    const edges = laneEdges([{ a: "p", b: "q" }], EDGES);
    expect(edges).toEqual([{ a: "p", b: "q" }]);
  });

  it("keeps a gated strait gated, so the passage layer still owns its styling", () => {
    const gated = EDGES.find((edge) => edge.passage !== undefined);
    expect(gated).toBeDefined();
    const edges = laneEdges([{ a: gated!.a, b: gated!.b }], EDGES);
    expect(edges[0]?.passage).toBe(gated!.passage);
    expect(buildLanes(edges, anchors, projection.width)).toEqual([]);
  });

  it("draws nothing for a campaign that has no sea connectivity", () => {
    expect(buildLanes(laneEdges([], EDGES), anchors, projection.width)).toEqual([]);
  });
});
