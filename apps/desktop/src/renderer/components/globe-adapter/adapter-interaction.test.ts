import { describe, expect, it } from "vite-plus/test";
import {
  adapterDrop,
  dragThresholdMet,
  fleetIdFromMarker,
  isDraggableFleet,
  routeAnnouncement,
} from "./adapter-interaction.js";
import type { MapOrders } from "../world-map/map-orders.js";

const orders: MapOrders = {
  fleets: [
    {
      fleetId: "fleet-home",
      fleetName: "Home Fleet",
      areaId: "area_north_sea",
      mapAreaId: "area_north_sea",
      areaName: "North Sea",
      shipCount: 12,
      legalDestinations: [
        {
          areaId: "western-approaches",
          mapAreaId: "area_western_approaches",
          name: "Western Approaches",
        },
      ],
      blockedReason: null,
    },
    {
      fleetId: "fleet-stuck",
      fleetName: "Stuck Fleet",
      areaId: "area_baltic",
      mapAreaId: null,
      areaName: "Baltic",
      shipCount: 2,
      legalDestinations: [],
      blockedReason: null,
    },
  ],
  pending: [],
  blockadedMapAreas: new Set(),
  selectedFleetId: null,
  onSelectFleet: () => undefined,
  onDrop: () => undefined,
};

describe("adapter interaction", () => {
  it("recognises fleet markers and ignores ports", () => {
    expect(fleetIdFromMarker("fleet:fleet-home")).toBe("fleet-home");
    expect(fleetIdFromMarker("port:london")).toBeNull();
    expect(fleetIdFromMarker(null)).toBeNull();
  });

  it("only starts a drag for a placed fleet with a legal destination", () => {
    expect(isDraggableFleet(orders, "fleet-home")).toBe(true);
    expect(isDraggableFleet(orders, "fleet-stuck")).toBe(false);
    expect(isDraggableFleet(undefined, "fleet-home")).toBe(false);
  });

  it("uses a six pixel drag threshold so a click still selects", () => {
    expect(dragThresholdMet({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(false);
    expect(dragThresholdMet({ x: 10, y: 10 }, { x: 16, y: 10 })).toBe(true);
  });

  it("resolves a drop through the shared legal-destination contract", () => {
    expect(adapterDrop(orders, "fleet-home", "area_western_approaches")).toEqual({
      kind: "order",
      destination: {
        areaId: "western-approaches",
        mapAreaId: "area_western_approaches",
        name: "Western Approaches",
      },
    });
    expect(adapterDrop(orders, "fleet-home", "area_baltic").kind).toBe("ignored");
    expect(adapterDrop(orders, "fleet-home", null).kind).toBe("ignored");
  });

  it("announces route readings and the empty prompt", () => {
    expect(routeAnnouncement(null)).toContain("Shift-click two areas");
    expect(
      routeAnnouncement({
        path: ["area_north_sea", "area_western_approaches"],
        hops: 1,
        nauticalMiles: 420,
        perHop: 420,
        months: 0.1,
      }),
    ).toBe(
      "Route reading: 1 hops, 420 nautical miles, 420 nautical miles per hop, about 0.1 months.",
    );
  });
});
