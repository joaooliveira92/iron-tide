import { describe, expect, it } from "vite-plus/test";
import { buildLanes } from "./map-lanes.js";
import { projectAreas, projectionById } from "./projection.js";
import { AREAS } from "./map-geometry.js";

const projection = projectionById("miller");
const areas = projectAreas(AREAS, projection, 0);
const anchors = new Map(areas.map((area) => [area.id, area.label] as const));

describe("buildLanes", () => {
  it("draws one lane per campaign sea route, and no others", () => {
    const lanes = buildLanes(
      [
        { a: "area_north_sea", b: "area_western_approaches" },
        { a: "area_baltic", b: "area_north_sea" },
      ],
      anchors,
      projection.width,
    );
    expect(lanes.map((lane) => lane.id)).toEqual([
      "area_baltic~area_north_sea",
      "area_north_sea~area_western_approaches",
    ]);
  });

  it("draws nothing when the campaign has no sea connectivity", () => {
    expect(buildLanes([], anchors, projection.width)).toEqual([]);
  });

  it("is deterministic: the same inputs give the same lanes in the same order", () => {
    const edges = [
      { a: "area_north_sea", b: "area_western_approaches" },
      { a: "area_baltic", b: "area_north_sea" },
    ];
    const first = buildLanes(edges, anchors, projection.width);
    const second = buildLanes([...edges].reverse(), anchors, projection.width);
    expect(second.map((lane) => lane.id)).toEqual(first.map((lane) => lane.id));
    expect(buildLanes(edges, anchors, projection.width)).toEqual(first);
  });

  it("deduplicates a lane authored in both directions", () => {
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

  it("skips a lane whose end has no geometry rather than guessing a point", () => {
    expect(buildLanes([{ a: "p", b: "ghost" }], new Map([["p", [1, 1] as const]]), 1000)).toEqual(
      [],
    );
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
    for (const lane of buildLanes(
      [{ a: "area_north_sea", b: "area_baltic" }],
      anchors,
      projection.width,
    )) {
      expect([...lane.from, ...lane.to].every(Number.isFinite)).toBe(true);
    }
  });
});
