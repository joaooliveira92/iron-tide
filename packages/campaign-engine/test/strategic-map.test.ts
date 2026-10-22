import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { CampaignSnapshot, FleetState, Ship } from "@bluewave/campaign";
import { buildStrategicMapView } from "../src/strategic-map.js";
import { fixtureNation, fixtureSnapshot } from "./fixtures.js";

function makeShip(id: string, name: string, overrides: Partial<Ship> = {}): Ship {
  return {
    id,
    name,
    classId: name,
    nationId: "uk",
    locationAreaId: "eng_home_coast",
    designVersionId: "des_1",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...overrides,
  };
}

function makeFleet(
  id: string,
  name: string,
  ships: Ship[],
  locationAreaId: string,
  nationId = "uk",
): FleetState {
  return { id, nationId, name, ships, locationAreaId };
}

const homeWorld: Partial<CampaignSnapshot> = {
  world: {
    areas: [
      { id: "eng_home_coast", name: "English Home Waters", type: "coastal", controller: "uk" },
      { id: "fra_med_coast", name: "French Mediterranean", type: "coastal", controller: "france" },
      { id: "sea_english_channel", name: "English Channel", type: "sea" },
      { id: "sea_north_sea", name: "North Sea", type: "sea" },
      { id: "sea_isolated", name: "Isolated Sea", type: "sea" },
      { id: "land_beach", name: "Beach", type: "land" },
    ],
    routes: [
      {
        id: "r_home_channel",
        from: "eng_home_coast",
        to: "sea_english_channel",
        type: "sea",
        distance: SafeInt(300),
      },
      {
        id: "r_home_fra",
        from: "eng_home_coast",
        to: "fra_med_coast",
        type: "sea",
        distance: SafeInt(900),
      },
      {
        id: "r_channel_north",
        from: "sea_english_channel",
        to: "sea_north_sea",
        type: "sea",
        distance: SafeInt(400),
      },
      {
        id: "r_home_beach",
        from: "eng_home_coast",
        to: "land_beach",
        type: "sea",
        distance: SafeInt(50),
      },
      {
        id: "r_home_rail",
        from: "eng_home_coast",
        to: "land_beach",
        type: "rail",
        distance: SafeInt(90),
      },
    ],
    ports: [],
  },
};

const twoNationSnapshot = (ukFleets: FleetState[], fraFleets: FleetState[]) =>
  fixtureSnapshot(
    [
      fixtureNation({ id: "uk", name: "Britain", tag: "GBR", fleets: ukFleets }),
      fixtureNation({ id: "france", name: "France", tag: "FRA", fleets: fraFleets }),
    ],
    [],
    homeWorld,
  );

describe("buildStrategicMapView visibility (DR-0037 Option B)", () => {
  const ukFleet = makeFleet(
    "fleet_gbr_home",
    "Home Fleet",
    [makeShip("gbr_dreadnought", "HMS Dreadnought"), makeShip("gbr_inflexible", "HMS Inflexible")],
    "eng_home_coast",
  );
  const fraFleet = makeFleet(
    "fleet_fra_med",
    "Escadre",
    [makeShip("fra_redoutable", "Redoutable", { nationId: "france" })],
    "fra_med_coast",
    "france",
  );

  it("returns the viewer's own fleets in full and withholds every foreign fleet", () => {
    const view = buildStrategicMapView(twoNationSnapshot([ukFleet], [fraFleet]), "uk");
    expect(view.world.fleets).toEqual([
      {
        id: "fleet_gbr_home",
        nationId: "uk",
        name: "Home Fleet",
        areaId: "eng_home_coast",
        shipCount: 2,
      },
    ]);
    expect(
      buildStrategicMapView(twoNationSnapshot([ukFleet], [fraFleet]), "france").world.fleets,
    ).toEqual([
      {
        id: "fleet_fra_med",
        nationId: "france",
        name: "Escadre",
        areaId: "fra_med_coast",
        shipCount: 1,
      },
    ]);
  });

  it("keeps the public facts: nations, areas, ports and routes are unfiltered", () => {
    const view = buildStrategicMapView(twoNationSnapshot([ukFleet], [fraFleet]), "uk");
    expect(view.world.nations.map((n) => n.id)).toEqual(["france", "uk"]);
    expect(view.world.areas.map((a) => a.id)).toEqual([
      "eng_home_coast",
      "fra_med_coast",
      "land_beach",
      "sea_english_channel",
      "sea_isolated",
      "sea_north_sea",
    ]);
    expect(view.world.routes.map((r) => r.id)).toEqual([
      "r_channel_north",
      "r_home_beach",
      "r_home_channel",
      "r_home_fra",
      "r_home_rail",
    ]);
  });
});

describe("buildStrategicMapView legal destinations", () => {
  it("lists the areas one sea hop away that the engine's own rule accepts, in area-id order", () => {
    const fleet = makeFleet(
      "fleet_gbr_home",
      "Home Fleet",
      [makeShip("gbr_dreadnought", "HMS Dreadnought")],
      "eng_home_coast",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets).toEqual([
      {
        fleetId: "fleet_gbr_home",
        fleetName: "Home Fleet",
        areaId: "eng_home_coast",
        shipCount: 1,
        legalDestinations: ["fra_med_coast", "sea_english_channel"],
        blockedReason: null,
      },
    ]);
  });

  it("stops at one hop: a two-route journey is not offered", () => {
    const fleet = makeFleet(
      "fleet_chn",
      "Channel Squadron",
      [makeShip("gbr_chn", "HMS Channel")],
      "sea_english_channel",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets[0]?.legalDestinations).toEqual(["eng_home_coast", "sea_north_sea"]);
  });

  it("reports a healthy fleet with no sea routes as unblocked with no destinations", () => {
    const fleet = makeFleet(
      "fleet_iso",
      "Isolated",
      [makeShip("gbr_iso", "HMS Isolated")],
      "sea_isolated",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets[0]).toMatchObject({ legalDestinations: [], blockedReason: null });
  });

  it("reproduces the engine's FOREIGN_STATION_ASSIGNED code and message verbatim", () => {
    const fleet = makeFleet(
      "fleet_gbr_home",
      "Home Fleet",
      [
        makeShip("gbr_dreadnought", "HMS Dreadnought", { stationAssignment: "FOREIGN_STATION" }),
        makeShip("gbr_inflexible", "HMS Inflexible"),
      ],
      "eng_home_coast",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets[0]?.blockedReason).toEqual({
      code: "FOREIGN_STATION_ASSIGNED",
      message:
        "HMS Dreadnought is on foreign station and is routed by the month; clear its assignment before ordering fleet Home Fleet to move",
    });
    expect(view.playerFleets[0]?.legalDestinations).toEqual([]);
  });

  it("reproduces SHIP_NOT_OPERATIONAL when no commissioned ship exists", () => {
    const fleet = makeFleet(
      "fleet_gbr_home",
      "Home Fleet",
      [makeShip("gbr_keel", "HMS Keel", { isUnderConstruction: true })],
      "eng_home_coast",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets[0]?.blockedReason).toEqual({
      code: "SHIP_NOT_OPERATIONAL",
      message: "Fleet Home Fleet has no commissioned ship",
    });
  });

  it("reproduces SHIP_UNAVAILABLE when a rebuild shares a fleet with a commissioned ship", () => {
    const fleet = makeFleet(
      "fleet_gbr_home",
      "Home Fleet",
      [
        makeShip("gbr_dreadnought", "HMS Dreadnought"),
        makeShip("gbr_rebuild", "HMS Rebuild", { availability: "UNAVAILABLE" }),
      ],
      "eng_home_coast",
    );
    const view = buildStrategicMapView(twoNationSnapshot([fleet], []), "uk");
    expect(view.playerFleets[0]?.blockedReason).toEqual({
      code: "SHIP_UNAVAILABLE",
      message: "HMS Rebuild is under rebuild and cannot sail; fleet Home Fleet cannot move with it",
    });
  });
});

describe("buildStrategicMapView blockades", () => {
  const blockaded = fixtureSnapshot(
    [
      fixtureNation({ id: "uk", name: "Britain", tag: "GBR" }),
      fixtureNation({ id: "france", name: "France", tag: "FRA" }),
    ],
    [],
    {
      ...homeWorld,
      wars: {
        wars: [],
        battles: [],
        participantMemberships: [],
        battleManifests: [],
        blockadeState: [
          {
            blockaderId: "russia",
            blockadedNationId: "ottoman",
            areaId: "sea_bosporus",
            establishedMonth: "1880-02",
          },
          {
            blockaderId: "uk",
            blockadedNationId: "france",
            areaId: "sea_english_channel",
            establishedMonth: "1880-01",
          },
          {
            blockaderId: "uk",
            blockadedNationId: "france",
            areaId: "fra_med_coast",
            establishedMonth: "1880-03",
          },
        ],
      },
    },
  );

  it("returns only the rows the viewer is party to, ordered by area then nations", () => {
    expect(buildStrategicMapView(blockaded, "uk").blockades).toEqual([
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "fra_med_coast",
        establishedMonth: "1880-03",
      },
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "sea_english_channel",
        establishedMonth: "1880-01",
      },
    ]);
    expect(buildStrategicMapView(blockaded, "france").blockades).toEqual([
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "fra_med_coast",
        establishedMonth: "1880-03",
      },
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "sea_english_channel",
        establishedMonth: "1880-01",
      },
    ]);
    expect(buildStrategicMapView(blockaded, "russia").blockades).toEqual([
      {
        blockaderId: "russia",
        blockadedNationId: "ottoman",
        areaId: "sea_bosporus",
        establishedMonth: "1880-02",
      },
    ]);
    expect(buildStrategicMapView(blockaded, "ottoman").blockades).toEqual([
      {
        blockaderId: "russia",
        blockadedNationId: "ottoman",
        areaId: "sea_bosporus",
        establishedMonth: "1880-02",
      },
    ]);
  });
});
