import { describe, expect, it } from "vite-plus/test";

import {
  OverlayContractError,
  assertOverlayFeature,
  type OverlayFeature,
} from "./overlay-contract.js";
import { OverlayStore } from "./overlay-store.js";
import { projectOverlay } from "./overlay-projection.js";
import { routeCoordinates } from "./route-geometry.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";

function point(id: string, lon: number, lat: number, order = 0): OverlayFeature {
  return {
    id,
    kind: "marker",
    order,
    minZoom: 0,
    markerClass: "port",
    label: id,
    geometry: { type: "Point", lon, lat },
  };
}

function line(id: string, coordinates: readonly (readonly [number, number])[]): OverlayFeature {
  return {
    id,
    kind: "route",
    order: 0,
    minZoom: 0,
    routeClass: "static",
    geometry: { type: "LineString", coordinates, semantics: "lonlat-linear" },
  };
}

describe("overlay store", () => {
  it("keeps stable kind, order and id ordering", () => {
    const store = new OverlayStore();
    store.replace([
      point("marker-b", 1, 1, 2),
      line("route-b", [
        [0, 0],
        [1, 1],
      ]),
      point("marker-a", 0, 0, 1),
      line("route-a", [
        [2, 2],
        [3, 3],
      ]),
    ]);
    expect(store.snapshot().features.map((feature) => feature.id)).toEqual([
      "route-a",
      "route-b",
      "marker-a",
      "marker-b",
    ]);
  });

  it("emits one change when one marker changes and rebuilds no other feature", () => {
    const store = new OverlayStore();
    store.replace([point("marker-a", 0, 0), point("marker-b", 1, 1)]);
    const seen: string[] = [];
    store.subscribe((changeSet) => {
      for (const change of changeSet.changes) seen.push(`${change.type}:${change.id}`);
    });
    store.apply([{ type: "upsert", id: "marker-b", feature: point("marker-b", 2, 2) }]);
    expect(seen).toEqual(["upsert:marker-b"]);
    expect(store.snapshot().features).toHaveLength(2);
    expect(store.snapshot().version).toBe(2);
  });

  it("replaces only changed and removed routes", () => {
    const store = new OverlayStore();
    store.replace([
      point("marker-a", 0, 0),
      line("route-a", [
        [0, 0],
        [1, 1],
      ]),
      line("route-b", [
        [2, 2],
        [3, 3],
      ]),
    ]);
    const changeSet = store.replaceRoutes([
      line("route-b", [
        [2, 2],
        [4, 4],
      ]),
      line("route-c", [
        [5, 5],
        [6, 6],
      ]),
    ]);
    expect(changeSet.changes.map((change) => `${change.type}:${change.id}`)).toEqual([
      "remove:route-a",
      "upsert:route-b",
      "upsert:route-c",
    ]);
    expect(store.snapshot().features.map((feature) => feature.id)).toEqual([
      "route-b",
      "route-c",
      "marker-a",
    ]);
  });

  it("applies simultaneous changes in id order and rejects duplicates", () => {
    const store = new OverlayStore();
    const changeSet = store.apply([
      { type: "upsert", id: "z", feature: point("z", 1, 1) },
      { type: "upsert", id: "a", feature: point("a", 2, 2) },
    ]);
    expect(changeSet.changes.map((change) => change.id)).toEqual(["a", "z"]);
    expect(() =>
      store.apply([
        { type: "upsert", id: "a", feature: point("a", 3, 3) },
        { type: "upsert", id: "a", feature: point("a", 4, 4) },
      ]),
    ).toThrow("duplicate overlay change");
  });

  it("tracks selection, hover and visibility without rebuilding geometry", () => {
    const store = new OverlayStore();
    store.replace([point("marker-a", 0, 0), point("marker-b", 1, 1)]);
    const selections: string[] = [];
    const visibility: string[] = [];
    store.subscribeSelection((selection) =>
      selections.push(`${selection.selectedId}:${selection.hoveredId}`),
    );
    store.subscribeVisibility((change) => visibility.push(`${change.id}:${change.visible}`));
    store.setSelection("marker-a");
    store.setHovered("marker-b");
    store.setVisible("marker-b", false);
    store.setVisible("marker-b", false);
    expect(selections).toEqual(["marker-a:null", "marker-a:marker-b"]);
    expect(visibility).toEqual(["marker-b:false"]);
    expect(store.visible("marker-a")).toBe(true);
    expect(store.visible("marker-b")).toBe(false);
    expect(store.snapshot().version).toBe(1);
  });

  it("disposes listeners and rejects later changes", () => {
    const store = new OverlayStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.replace([point("marker-a", 0, 0)]);
    store.dispose();
    expect(calls).toBe(1);
    expect(() => store.replace([point("marker-b", 1, 1)])).toThrow("disposed");
  });

  it("rejects a route without explicit edge semantics", () => {
    const invalid = line("route-a", [
      [0, 0],
      [1, 1],
    ]);
    Reflect.set(invalid, "routeClass", "bogus");
    expect(() => assertOverlayFeature(invalid)).toThrow(OverlayContractError);
  });
});

describe("route geometry", () => {
  const longRoute = [
    [-157.86, 21.31],
    [139.65, 35.45],
  ] as const;

  it("unwraps a Pacific route to the short way across the antimeridian", () => {
    const linear = routeCoordinates(longRoute, "lonlat-linear");
    expect(linear).toHaveLength(2);
    expect(Math.abs((linear[1]?.[0] ?? 0) - (linear[0]?.[0] ?? 0))).toBeLessThan(180);
  });

  it("densifies great-circle and rhumb routes with different intermediate points", () => {
    const greatCircle = routeCoordinates(longRoute, "great-circle");
    const rhumb = routeCoordinates(longRoute, "rhumb");
    expect(greatCircle.length).toBeGreaterThan(2);
    expect(rhumb.length).toBeGreaterThan(2);
    expect(greatCircle[Math.floor(greatCircle.length / 2)]).not.toEqual(
      rhumb[Math.floor(rhumb.length / 2)],
    );
  });

  it("keeps lonlat-linear coordinates exactly as supplied after unwrapping", () => {
    const coordinates = routeCoordinates(
      [
        [10, 10],
        [20, 20],
        [30, 15],
      ],
      "lonlat-linear",
    );
    expect(coordinates).toEqual([
      [10, 10],
      [20, 20],
      [30, 15],
    ]);
  });
});

describe("overlay projection", () => {
  it("maps campaign ports and fleets to stable marker ids", () => {
    const overlay = {
      ...EMPTY_LIVE_OVERLAY,
      source: "campaign" as const,
      ports: [
        { id: "port-b", name: "B", area: "area_north_sea", nation: "nation_gb", level: 7 },
        { id: "port-a", name: "A", area: "area_north_sea", nation: "nation_gb", level: 4 },
      ],
      fleets: [
        { id: "fleet-a", name: "Fleet A", area: "area_north_sea", nation: "nation_gb", ships: 4 },
      ],
    };
    const result = projectOverlay({
      overlay,
      state: initialMapPrototypeState,
      route: null,
    });
    expect(result.features.map((feature) => feature.id)).toEqual([
      "port:port-a",
      "port:port-b",
      "fleet:fleet-a",
    ]);
    expect(result.features.every((feature) => feature.kind === "marker")).toBe(true);
  });

  it("separates static lanes, planned orders and preview routes", () => {
    const overlay = {
      ...EMPTY_LIVE_OVERLAY,
      source: "campaign" as const,
      lanes: [{ a: "area_north_sea", b: "area_mediterranean" }],
    };
    const result = projectOverlay({
      overlay,
      state: initialMapPrototypeState,
      route: {
        path: ["area_north_sea", "area_mediterranean"],
        hops: 1,
        nauticalMiles: 1,
        perHop: 1,
        months: 1,
      },
      orders: {
        fleets: [],
        pending: [
          {
            commandId: "command-a",
            fleetId: "fleet-a",
            fromMapAreaId: "area_north_sea",
            toMapAreaId: "area_mediterranean",
            destinationName: "Mediterranean",
          },
        ],
        blockadedMapAreas: new Set(),
        selectedFleetId: null,
        onSelectFleet: () => undefined,
        onDrop: () => undefined,
      },
    });
    const routes = result.features.filter((feature) => feature.kind === "route");
    expect(routes.map((route) => route.id)).toEqual([
      "lane:area_north_sea~area_mediterranean",
      "pending:command-a",
      "preview:area_north_sea>area_mediterranean",
    ]);
    expect(routes.map((route) => route.routeClass)).toEqual(["static", "planned", "preview"]);
    expect(
      routes.every(
        (route) =>
          route.geometry.type === "LineString" && route.geometry.semantics === "lonlat-linear",
      ),
    ).toBe(true);
  });
});
