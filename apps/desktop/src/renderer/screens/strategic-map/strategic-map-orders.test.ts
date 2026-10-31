/* @vitest-environment jsdom */
import { describe, expect, it } from "vite-plus/test";
import type { MovementCommand, StrategicMapView } from "@bluewave/campaign-engine";
import type { MapOrderFleet } from "../../components/world-map/map-orders.js";
import { blockadedMapAreas, orderFleets, pendingOrders } from "./strategic-map-orders.js";

const names = new Map([
  ["sea_north_sea", "North Sea"],
  ["sea_english_channel", "Western Approaches"],
]);

const strategic: StrategicMapView = {
  world: {
    nations: [],
    areas: [
      { id: "sea_north_sea", name: "North Sea", type: "sea", controller: "GBR" },
      { id: "sea_english_channel", name: "Western Approaches", type: "sea", controller: "GBR" },
    ],
    ports: [],
    fleets: [],
    routes: [],
  },
  playerFleets: [
    {
      fleetId: "home-fleet",
      fleetName: "Home Fleet",
      areaId: "sea_north_sea",
      shipCount: 12,
      legalDestinations: ["sea_english_channel"],
      blockedReason: null,
    },
  ],
  blockades: [
    {
      blockaderId: "FRA",
      blockadedNationId: "GBR",
      areaId: "sea_english_channel",
      establishedMonth: "1880-03",
    },
  ],
};

const command: MovementCommand = {
  commandId: "cmd-1",
  divisionId: "home-fleet",
  fromAreaId: "sea_north_sea",
  toAreaId: "sea_english_channel",
  status: "submitted",
  submittedAtRevision: 4,
};

describe("orderFleets", () => {
  it("joins campaign areas to map polygons and names the destinations", () => {
    expect(orderFleets(strategic, names)).toEqual([
      {
        fleetId: "home-fleet",
        fleetName: "Home Fleet",
        areaId: "sea_north_sea",
        mapAreaId: "area_north_sea",
        areaName: "North Sea",
        shipCount: 12,
        legalDestinations: [
          {
            areaId: "sea_english_channel",
            mapAreaId: "area_western_approaches",
            name: "Western Approaches",
          },
        ],
        blockedReason: null,
      },
    ]);
  });

  it("returns no fleets before the projection arrives", () => {
    expect(orderFleets(null, names)).toEqual([]);
  });

  it("keeps a legal destination the map cannot place, but gives it no polygon", () => {
    const fleet = orderFleets(
      {
        ...strategic,
        playerFleets: [{ ...strategic.playerFleets[0]!, legalDestinations: ["sea_nowhere"] }],
      },
      names,
    )[0];
    expect(fleet?.fleetId).toBe("home-fleet");
    expect(fleet?.legalDestinations).toEqual([]);
  });
});

describe("blockadedMapAreas", () => {
  it("maps the blockaded campaign areas the player is party to", () => {
    expect([...blockadedMapAreas(strategic)]).toEqual(["area_western_approaches"]);
  });

  it("is empty with no projection", () => {
    expect([...blockadedMapAreas(null)]).toEqual([]);
  });
});

describe("pendingOrders", () => {
  const fleets: readonly MapOrderFleet[] = orderFleets(strategic, names);

  it("keeps only submitted commands and names the destination polygon", () => {
    expect(pendingOrders([command], fleets)).toEqual([
      {
        commandId: "cmd-1",
        fleetId: "home-fleet",
        fromMapAreaId: "area_north_sea",
        toMapAreaId: "area_western_approaches",
        fromAreaId: command.fromAreaId,
        toAreaId: command.toAreaId,
        destinationName: "Western Approaches",
      },
    ]);
    expect(
      pendingOrders(
        [
          { ...command, status: "cancelled" },
          { ...command, status: "accepted" },
        ],
        fleets,
      ),
    ).toEqual([]);
  });

  it("drops a command for a fleet the projection no longer shows", () => {
    expect(pendingOrders([{ ...command, divisionId: "ghost" }], fleets)).toEqual([]);
  });
});
