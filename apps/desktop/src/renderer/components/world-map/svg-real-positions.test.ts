import { describe, expect, it } from "vite-plus/test";

import { AREA_ANCHORS } from "./campaign-anchors.js";
import { EMPTY_LIVE_OVERLAY, orderLonLatPath } from "./campaign-map-join.js";
import { buildSeaLanes, projectContinuousPath } from "./map-lanes.js";
import { fleetSingles } from "./map-markers.js";
import { pendingRoutes, type MapPendingOrder } from "./map-orders.js";
import { campaignWorldMapSource } from "./world-map-source.js";
import { projectPoint, projectionById, type Point } from "./projection.js";

const projection = projectionById("equirectangular");
const locate = (lonLat: Point): Point => projectPoint(lonLat, projection, 0);

const channelLane = {
  id: "r_chan_north",
  from: "sea_english_channel",
  to: "sea_north_sea",
  path: [
    [-3, 49.7],
    [1.3, 50.95],
    [3.2, 55.2],
  ] as const,
};

function order(patch: Partial<MapPendingOrder> = {}): MapPendingOrder {
  return {
    commandId: "c1",
    fleetId: "f1",
    fromMapAreaId: "area_western_approaches",
    toMapAreaId: "area_north_sea",
    fromAreaId: "sea_english_channel",
    toAreaId: "sea_north_sea",
    destinationName: "North Sea",
    ...patch,
  };
}

describe("projectContinuousPath", () => {
  it("keeps a path that crosses the antimeridian continuous", () => {
    const projected = projectContinuousPath(
      [
        [-123.2, 37.6],
        [165, 36],
      ],
      locate,
      projection.width,
    );
    expect(Math.abs((projected[1] as Point)[0] - (projected[0] as Point)[0])).toBeLessThan(
      projection.width / 2,
    );
  });
});

describe("buildSeaLanes", () => {
  it("draws a lane through its waypoints, ordered by id", () => {
    const lanes = buildSeaLanes(
      [
        {
          id: "z",
          path: [
            [0, 0],
            [10, 10],
          ],
        },
        { id: channelLane.id, path: channelLane.path },
      ],
      locate,
      projection.width,
    );
    expect(lanes.map((lane) => lane.id)).toEqual(["r_chan_north", "z"]);
    expect(lanes[0]?.via).toHaveLength(1);
    expect(lanes[0]?.from).toEqual(locate([-3, 49.7]));
    expect(lanes[0]?.to).toEqual(locate([3.2, 55.2]));
  });

  it("skips a lane with fewer than two points", () => {
    expect(buildSeaLanes([{ id: "x", path: [[0, 0]] }], locate, projection.width)).toEqual([]);
  });
});

describe("orderLonLatPath", () => {
  const overlay = { seaLanes: [channelLane] };

  it("follows the lane in the order's direction and reversed against it", () => {
    expect(orderLonLatPath(overlay, order())).toEqual(channelLane.path);
    expect(
      orderLonLatPath(
        overlay,
        order({ fromAreaId: "sea_north_sea", toAreaId: "sea_english_channel" }),
      ),
    ).toEqual([...channelLane.path].reverse());
  });

  it("joins the two area anchors when no lane connects them", () => {
    expect(orderLonLatPath({ seaLanes: [] }, order({ toAreaId: "sea_baltic" }))).toEqual([
      AREA_ANCHORS["sea_english_channel"],
      AREA_ANCHORS["sea_baltic"],
    ]);
  });

  it("falls back to the fixture polygons for an order without campaign ids", () => {
    const path = orderLonLatPath(
      { seaLanes: [] },
      { fromMapAreaId: "area_north_sea", toMapAreaId: "area_baltic" },
    );
    expect(path).toHaveLength(2);
    expect(
      orderLonLatPath({ seaLanes: [] }, { fromMapAreaId: "nope", toMapAreaId: "area_baltic" }),
    ).toBeNull();
  });
});

describe("pendingRoutes with a lane path", () => {
  it("uses the supplied path for from, via and to", () => {
    const path: Point[] = [
      [10, 10],
      [20, 25],
      [40, 30],
    ];
    const routes = pendingRoutes(
      [order()],
      () => undefined,
      () => path,
    );
    expect(routes).toEqual([{ ...order(), from: [10, 10], to: [40, 30], via: [[20, 25]] }]);
  });

  it("falls back to the polygon anchors when the path is unavailable", () => {
    const routes = pendingRoutes(
      [order()],
      () => [1, 2],
      () => null,
    );
    expect(routes).toEqual([{ ...order(), from: [1, 2], to: [1, 2] }]);
  });
});

describe("fleetSingles with real positions", () => {
  const anchors = new Map<string, Point>([["area_north_sea", [500, 200]]]);
  const fleet = { id: "f", area: "area_north_sea", ships: 2, owner: "uk" };

  it("projects a fleet's own coordinates instead of its fixture polygon", () => {
    const [mark] = fleetSingles([{ ...fleet, at: [-3, 49.7] }], anchors, locate);
    const expected = locate([-3, 49.7]);
    expect(mark?.ux).toBe(expected[0] - 16);
    expect(mark?.uy).toBe(expected[1] + 18);
  });

  it("keeps the polygon anchor for a fleet with no coordinates", () => {
    const [mark] = fleetSingles([fleet], anchors, locate);
    expect(mark?.ux).toBe(500 - 16);
  });
});

describe("campaignWorldMapSource ports and fleets", () => {
  it("places ports and fleets at their own coordinates", () => {
    const source = campaignWorldMapSource({
      ...EMPTY_LIVE_OVERLAY,
      source: "campaign",
      ports: [
        {
          id: "p",
          name: "P",
          area: "area_north_sea",
          nation: "uk",
          level: 5,
          anchor: [-1.1, 50.8],
        },
      ],
      fleets: [
        { id: "f", name: "F", area: "area_north_sea", nation: "uk", ships: 1, anchor: [1, 50.6] },
      ],
    });
    expect(source.ports[0]?.at).toEqual([-1.1, 50.8]);
    expect(source.fleets[0]?.at).toEqual([1, 50.6]);
  });

  it("falls back to the fixture polygon when no coordinates are given", () => {
    const source = campaignWorldMapSource({
      ...EMPTY_LIVE_OVERLAY,
      source: "campaign",
      ports: [{ id: "p", name: "P", area: "area_north_sea", nation: "uk", level: 5 }],
      fleets: [{ id: "f", name: "F", area: "area_north_sea", nation: "uk", ships: 1 }],
    });
    expect(source.ports[0]?.at).toEqual([3, 56]);
    expect(source.fleets[0]?.at).toBeUndefined();
  });
});
