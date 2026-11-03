import { describe, expect, it } from "vite-plus/test";

import type { LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { AREA_ANCHORS, PORT_ANCHORS } from "../world-map/campaign-anchors.js";
import type { MapOrders } from "../world-map/map-orders.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import { projectOverlay } from "./overlay-projection.js";

function overlay(patch: Partial<LiveWorldMapOverlay>): LiveWorldMapOverlay {
  return { ...EMPTY_LIVE_OVERLAY, source: "campaign", ...patch };
}

function project(live: LiveWorldMapOverlay, orders?: MapOrders) {
  return projectOverlay({
    overlay: live,
    state: initialMapPrototypeState,
    route: null,
    ...(orders === undefined ? {} : { orders }),
  });
}

function ordersWith(pending: MapOrders["pending"]): MapOrders {
  return {
    fleets: [],
    pending,
    blockadedMapAreas: new Set(),
    selectedFleetId: null,
    onSelectFleet: () => undefined,
    onDrop: () => undefined,
  };
}

function pointOf(feature: { readonly geometry: unknown }): readonly [number, number] {
  const geometry = feature.geometry as { readonly lon: number; readonly lat: number };
  return [geometry.lon, geometry.lat];
}

describe("projectOverlay with campaign anchors", () => {
  it("places a port at its own coordinates and tags its nation", () => {
    const result = project(
      overlay({
        ports: [
          {
            id: "gbr_portsmouth",
            name: "Portsmouth",
            area: "area_north_sea",
            nation: "uk",
            level: 10,
            anchor: PORT_ANCHORS["gbr_portsmouth"] ?? null,
          },
          {
            id: "gbr_plymouth",
            name: "Plymouth",
            area: "area_north_sea",
            nation: "uk",
            level: 10,
            anchor: PORT_ANCHORS["gbr_plymouth"] ?? null,
          },
        ],
      }),
    );
    const [plymouth, portsmouth] = result.features;
    expect(plymouth?.id).toBe("port:gbr_plymouth");
    expect(pointOf(plymouth as never)).toEqual(PORT_ANCHORS["gbr_plymouth"]);
    expect(pointOf(portsmouth as never)).toEqual(PORT_ANCHORS["gbr_portsmouth"]);
    expect(plymouth?.nationId).toBe("uk");
  });

  it("falls back to the fixture area point when a port has no anchor", () => {
    const result = project(
      overlay({
        ports: [{ id: "p", name: "P", area: "area_north_sea", nation: "uk", level: 1 }],
      }),
    );
    expect(pointOf(result.features[0] as never)).toEqual([3, 56]);
  });

  it("fans fleets that share an area apart and leaves a lone fleet on its anchor", () => {
    const anchor = AREA_ANCHORS["eng_home_coast"] ?? null;
    const fleet = (id: string) => ({
      id,
      name: id,
      area: "area_north_sea",
      nation: "uk",
      ships: 1,
      anchor,
    });
    const crowded = project(overlay({ fleets: [fleet("a"), fleet("b"), fleet("c")] }));
    const points = crowded.features.map((feature) => pointOf(feature).join(","));
    expect(new Set(points).size).toBe(3);

    const alone = project(overlay({ fleets: [fleet("a")] }));
    expect(pointOf(alone.features[0] as never)).toEqual(anchor);
  });

  it("draws one lane per campaign sea route through its waypoints", () => {
    const path = [
      [-3, 49.7],
      [1.3, 50.95],
      [3.2, 55.2],
    ] as const;
    const result = project(
      overlay({
        lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
        seaLanes: [{ id: "r_chan_north", from: "sea_english_channel", to: "sea_north_sea", path }],
      }),
    );
    const lanes = result.features.filter((feature) => feature.overlayClass === "lane");
    expect(lanes.map((lane) => lane.id)).toEqual(["lane:r_chan_north"]);
    expect(lanes[0]?.geometry).toMatchObject({ coordinates: path.map((point) => [...point]) });
  });

  it("unwraps a lane that crosses the antimeridian so it does not span the world", () => {
    const result = project(
      overlay({
        seaLanes: [
          {
            id: "r_sf_yokohama",
            from: "usa_pacific_coast",
            to: "sea_pacific_n",
            path: [
              [-123.2, 37.6],
              [165, 36],
            ],
          },
        ],
      }),
    );
    const geometry = result.features[0]?.geometry as {
      readonly coordinates: readonly (readonly [number, number])[];
    };
    const longitudes = geometry.coordinates.map((point) => point[0]);
    for (let index = 1; index < longitudes.length; index++) {
      expect(
        Math.abs((longitudes[index] as number) - (longitudes[index - 1] as number)),
      ).toBeLessThan(180);
    }
  });

  it("follows the sea lane for a pending order, reversed when ordered the other way", () => {
    const path = [
      [-3, 49.7],
      [1.3, 50.95],
      [3.2, 55.2],
    ] as const;
    const live = overlay({
      seaLanes: [{ id: "r_chan_north", from: "sea_english_channel", to: "sea_north_sea", path }],
    });
    const forward = project(
      live,
      ordersWith([
        {
          commandId: "c1",
          fleetId: "f",
          fromMapAreaId: "area_western_approaches",
          toMapAreaId: "area_north_sea",
          fromAreaId: "sea_english_channel",
          toAreaId: "sea_north_sea",
          destinationName: "North Sea",
        },
      ]),
    );
    const backward = project(
      live,
      ordersWith([
        {
          commandId: "c2",
          fleetId: "f",
          fromMapAreaId: "area_north_sea",
          toMapAreaId: "area_western_approaches",
          fromAreaId: "sea_north_sea",
          toAreaId: "sea_english_channel",
          destinationName: "English Channel",
        },
      ]),
    );
    const coordinatesOf = (feature: { readonly geometry: unknown } | undefined) => {
      const geometry = feature?.geometry as
        | { readonly coordinates: readonly (readonly [number, number])[] }
        | undefined;
      return geometry?.coordinates;
    };
    expect(coordinatesOf(forward.features.find((feature) => feature.id === "pending:c1"))).toEqual(
      path.map((point) => [...point]),
    );
    expect(coordinatesOf(backward.features.find((feature) => feature.id === "pending:c2"))).toEqual(
      [...path].reverse().map((point) => [...point]),
    );
  });

  it("draws a straight pending order between area anchors when no lane joins them", () => {
    const result = project(
      overlay({}),
      ordersWith([
        {
          commandId: "c3",
          fleetId: "f",
          fromMapAreaId: "area_north_sea",
          toMapAreaId: "area_baltic",
          fromAreaId: "sea_north_sea",
          toAreaId: "sea_baltic",
          destinationName: "Baltic",
        },
      ]),
    );
    expect(result.features[0]?.geometry).toMatchObject({
      coordinates: [
        [...(AREA_ANCHORS["sea_north_sea"] ?? [])],
        [...(AREA_ANCHORS["sea_baltic"] ?? [])],
      ],
    });
  });
});
