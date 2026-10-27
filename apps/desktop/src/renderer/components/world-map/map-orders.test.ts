import { describe, expect, it } from "vite-plus/test";
import type { MapOrderFleet } from "./map-orders.js";
import {
  legalMapAreas,
  orderModeMapAreas,
  pendingForFleet,
  pendingRoutes,
  resolveDrop,
} from "./map-orders.js";

const fleet: MapOrderFleet = {
  fleetId: "home",
  fleetName: "Home Fleet",
  areaId: "sea_north_sea",
  mapAreaId: "area_north_sea",
  areaName: "North Sea",
  shipCount: 12,
  legalDestinations: [
    {
      areaId: "sea_western_approaches",
      mapAreaId: "area_western_approaches",
      name: "Western Approaches",
    },
    { areaId: "sea_channel", mapAreaId: "area_channel", name: "Channel" },
  ],
  blockedReason: null,
};

describe("resolveDrop", () => {
  it("orders the one campaign area behind a polygon", () => {
    expect(resolveDrop(fleet, "area_western_approaches")).toEqual({
      kind: "order",
      destination: {
        areaId: "sea_western_approaches",
        mapAreaId: "area_western_approaches",
        name: "Western Approaches",
      },
    });
  });

  it("offers a choice when a polygon joins several legal campaign areas", () => {
    const shared: MapOrderFleet = {
      ...fleet,
      legalDestinations: [
        { areaId: "sea_a", mapAreaId: "area_shared", name: "A" },
        { areaId: "sea_b", mapAreaId: "area_shared", name: "B" },
      ],
    };
    expect(resolveDrop(shared, "area_shared")).toEqual({
      kind: "choose",
      destinations: [
        { areaId: "sea_a", mapAreaId: "area_shared", name: "A" },
        { areaId: "sea_b", mapAreaId: "area_shared", name: "B" },
      ],
    });
  });

  it("ignores a drop on the fleet's own area, on an illegal area and on empty sea", () => {
    expect(resolveDrop(fleet, "area_north_sea").kind).toBe("ignored");
    expect(resolveDrop(fleet, "area_baltic").kind).toBe("ignored");
    expect(resolveDrop(fleet, null).kind).toBe("ignored");
  });

  it("ignores a drop when no fleet is selected", () => {
    expect(resolveDrop(null, "area_western_approaches").kind).toBe("ignored");
    expect(resolveDrop(undefined, "area_western_approaches").kind).toBe("ignored");
  });
});

describe("orderModeMapAreas", () => {
  it("highlights the legal set and does not dim when the fleet cannot move", () => {
    const blocked: MapOrderFleet = {
      ...fleet,
      legalDestinations: [],
      blockedReason: { code: "SHIP_NOT_OPERATIONAL", message: "No operational ship" },
    };
    expect(orderModeMapAreas(blocked)).toEqual({ active: false, legal: new Set() });
  });

  it("is inactive with no selection", () => {
    expect(orderModeMapAreas(null)).toEqual({ active: false, legal: new Set() });
  });

  it("names the legal map areas while a movable fleet is selected", () => {
    const mode = orderModeMapAreas(fleet);
    expect(mode.active).toBe(true);
    expect([...mode.legal].sort()).toEqual(["area_channel", "area_western_approaches"]);
  });
});

describe("legalMapAreas", () => {
  it("unions every fleet's legal map areas", () => {
    const other: MapOrderFleet = {
      ...fleet,
      fleetId: "channel",
      legalDestinations: [
        { areaId: "sea_channel", mapAreaId: "area_channel", name: "Channel" },
        { areaId: "sea_baltic", mapAreaId: "area_baltic", name: "Baltic" },
      ],
    };
    expect([...legalMapAreas([fleet, other])].sort()).toEqual([
      "area_baltic",
      "area_channel",
      "area_western_approaches",
    ]);
  });
});

describe("pending orders", () => {
  const pending = [
    {
      commandId: "cmd-1",
      fleetId: "home",
      fromMapAreaId: "area_north_sea",
      toMapAreaId: "area_western_approaches",
      destinationName: "Western Approaches",
    },
  ];

  it("finds the selected fleet's submitted order", () => {
    expect(pendingForFleet(pending, "home")?.commandId).toBe("cmd-1");
    expect(pendingForFleet(pending, "channel")).toBeNull();
    expect(pendingForFleet(pending, null)).toBeNull();
  });

  it("anchors a pending route on both polygons and drops one without geometry", () => {
    const anchored = pendingRoutes(pending, (id) =>
      id === "area_north_sea" ? [10, 20] : id === "area_western_approaches" ? [30, 40] : undefined,
    );
    expect(anchored).toEqual([
      {
        ...pending[0],
        from: [10, 20],
        to: [30, 40],
      },
    ]);
    expect(pendingRoutes(pending, () => undefined)).toEqual([]);
  });
});
