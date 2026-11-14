import { describe, expect, it } from "vite-plus/test";

import { overlayCollections } from "./map-style.js";
import { OVERLAY_SCHEMA_VERSION, type OverlayFeature } from "./overlay-contract.js";

const marker: OverlayFeature = {
  id: "port_a",
  kind: "marker",
  order: 0,
  minZoom: 0,
  markerClass: "port",
  geometry: { type: "Point", lon: 1, lat: 2 },
};
const route: OverlayFeature = {
  id: "route_a",
  kind: "route",
  order: 1,
  minZoom: 0,
  routeClass: "active",
  geometry: {
    type: "LineString",
    semantics: "great-circle",
    coordinates: [
      [0, 0],
      [3, 4],
    ],
  },
};
const label: OverlayFeature = {
  id: "area_a",
  kind: "areaLabel",
  order: 2,
  minZoom: 0,
  geometry: { type: "Point", lon: 5, lat: 6 },
};

describe("overlayCollections", () => {
  it("splits markers and routes in one pass and drops other kinds", () => {
    const { markers, routes } = overlayCollections({
      schemaVersion: OVERLAY_SCHEMA_VERSION,
      version: 1,
      features: [marker, label, route],
    });
    expect(markers.features.map((feature) => feature.id)).toEqual(["port_a"]);
    expect(routes.features.map((feature) => feature.id)).toEqual(["route_a"]);
  });

  it("returns empty collections for an empty snapshot", () => {
    const { markers, routes } = overlayCollections({
      schemaVersion: OVERLAY_SCHEMA_VERSION,
      version: 0,
      features: [],
    });
    expect(markers.features).toEqual([]);
    expect(routes.features).toEqual([]);
  });
});
