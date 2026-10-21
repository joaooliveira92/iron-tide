import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { FleetState, Ship } from "@bluewave/campaign";
import { buildFleetScreenView } from "../src/fleet.js";
import { fixtureDesign, fixtureNation, fixtureSnapshot } from "./fixtures.js";

/**
 * Pure projection tests for the Fleet screen view (desktop-mvp ticket 15),
 * mirroring `construction.test.ts`'s fixture pattern: hand-built snapshots,
 * no compiler run.
 */

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

function makeFleet(id: string, name: string, ships: Ship[], locationAreaId: string): FleetState {
  return { id, nationId: "uk", name, ships, locationAreaId };
}

describe("buildFleetScreenView", () => {
  it("maps only the player nation's compiled fleets into divisions with their real ships", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          fleets: [
            makeFleet(
              "fleet_gbr_home",
              "Home Fleet",
              [
                makeShip("gbr_inflexible", "HMS Inflexible", {
                  isUnderConstruction: true,
                  designVersionId: "des_gbr_inflexible",
                }),
                makeShip("gbr_dreadnought", "HMS Dreadnought", {
                  designVersionId: "des_gbr_dreadnought",
                }),
              ],
              "eng_home_coast",
            ),
          ],
        }),
        fixtureNation({
          id: "germany",
          fleets: [
            makeFleet(
              "fleet_ger_hochsee",
              "Hochseeflotte",
              [makeShip("ger_kaiser", "SMS Kaiser")],
              "ger_north_sea_coast",
            ),
          ],
        }),
      ],
      [],
    );

    const view = buildFleetScreenView(snapshot, "uk");

    // Only the player's fleet becomes a division; the foreign fleet is excluded.
    expect(view.divisions).toHaveLength(1);
    const home = view.divisions[0]!;
    expect(home.divisionId).toBe("fleet_gbr_home");
    expect(home.fleetName).toBe("Home Fleet");
    expect(home.areaId).toBe("eng_home_coast");
    expect(home.ships.map((s) => s.name)).toEqual(["HMS Inflexible", "HMS Dreadnought"]);
  });

  it("derives ship status from the readiness state and keeps designVersionId verbatim", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [
          makeFleet(
            "fleet_gbr_home",
            "Home Fleet",
            [
              makeShip("gbr_inflexible", "HMS Inflexible", {
                isUnderConstruction: true,
                designVersionId: "des_inflexible",
                readiness: "WORKING_UP",
                crewQuality: SafeInt(0),
              }),
              makeShip("gbr_dreadnought", "HMS Dreadnought", {
                isUnderConstruction: false,
                designVersionId: "",
              }),
            ],
            "eng_home_coast",
          ),
        ],
      }),
    ]);

    const view = buildFleetScreenView(snapshot, "uk");
    expect(view.divisions[0]!.ships).toEqual([
      {
        shipId: "gbr_inflexible",
        name: "HMS Inflexible",
        designId: "des_inflexible",
        status: "working_up",
        readiness: "WORKING_UP",
        crewQuality: 0,
      },
      {
        shipId: "gbr_dreadnought",
        name: "HMS Dreadnought",
        designId: "",
        status: "active",
        readiness: "ACTIVE",
        crewQuality: 100,
      },
    ]);
  });

  it("shows FS for a foreign-station ship and nothing extra for others (S-5 03)", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [
          makeFleet(
            "fleet_gbr_home",
            "Home Fleet",
            [
              makeShip("fs", "HMS Station", { stationAssignment: "FOREIGN_STATION" }),
              makeShip("home", "HMS Home"),
            ],
            "eng_home_coast",
          ),
        ],
      }),
    ]);
    const [fs, home] = buildFleetScreenView(snapshot, "uk").divisions[0]!.ships;
    expect(fs).toMatchObject({
      status: "active",
      readiness: "ACTIVE",
      stationAssignment: "FOREIGN_STATION",
      stationCode: "FS",
    });
    expect(home).not.toHaveProperty("stationAssignment");
    expect(home).not.toHaveProperty("stationCode");
  });

  it("shows c for a ship fitted for colonial service and nothing extra for others (S-5 04)", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [
          makeFleet(
            "fleet_gbr_home",
            "Home Fleet",
            [
              makeShip("c", "HMS Colonial", { colonialServiceFitted: true }),
              makeShip("plain", "HMS Plain"),
            ],
            "eng_home_coast",
          ),
        ],
      }),
    ]);
    const [fitted, plain] = buildFleetScreenView(snapshot, "uk").divisions[0]!.ships;
    expect(fitted).toMatchObject({ colonialServiceFitted: true, colonialCode: "c" });
    expect(plain).not.toHaveProperty("colonialServiceFitted");
    expect(plain).not.toHaveProperty("colonialCode");
  });

  it("shows * for an over-base ship and nothing extra for others (S-5 08)", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [
          makeFleet(
            "fleet_gbr_home",
            "Home Fleet",
            [
              makeShip("over", "HMS Over", { overBase: { maintenanceAdderBp: SafeInt(5_000) } }),
              makeShip("within", "HMS Within"),
            ],
            "eng_home_coast",
          ),
        ],
      }),
    ]);
    const [over, within] = buildFleetScreenView(snapshot, "uk").divisions[0]!.ships;
    expect(over).toMatchObject({ overBase: true, overBaseCode: "*" });
    expect(within).not.toHaveProperty("overBase");
    expect(within).not.toHaveProperty("overBaseCode");
  });

  it("shows the repair month count, a for cramped and S for short-range designs (manual p.48)", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          fleets: [
            makeFleet(
              "fleet_gbr_home",
              "Home Fleet",
              [
                makeShip("rep", "HMS Repair", {
                  readiness: "REPAIR",
                  repairMonthsRemaining: SafeInt(3),
                  designVersionId: "des_a",
                }),
                makeShip("plain", "HMS Plain", { designVersionId: "des_plain" }),
              ],
              "eng_home_coast",
            ),
          ],
        }),
      ],
      [
        fixtureDesign("uk", "des_a", { crampedAccommodation: true, shortRange: true }),
        fixtureDesign("uk", "des_plain"),
      ],
    );
    const [rep, plain] = buildFleetScreenView(snapshot, "uk").divisions[0]!.ships;
    expect(rep).toMatchObject({ repairMonthsRemaining: 3, crampedCode: "a", rangeCode: "S" });
    expect(plain).not.toHaveProperty("repairMonthsRemaining");
    expect(plain).not.toHaveProperty("crampedCode");
    expect(plain).not.toHaveProperty("rangeCode");
  });

  it("lists the over-base ships with their area for the readout (S-5 09)", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [
          makeFleet(
            "fleet_gbr_home",
            "Home Fleet",
            [
              makeShip("b_over", "HMS B", { overBase: { maintenanceAdderBp: SafeInt(5_000) } }),
              makeShip("a_over", "HMS A", { overBase: { maintenanceAdderBp: SafeInt(5_000) } }),
              makeShip("within", "HMS Within"),
            ],
            "eng_home_coast",
          ),
        ],
      }),
    ]);
    expect(buildFleetScreenView(snapshot, "uk").overBaseShips).toEqual([
      { shipId: "a_over", name: "HMS A", areaId: "eng_home_coast" },
      { shipId: "b_over", name: "HMS B", areaId: "eng_home_coast" },
    ]);
    expect(buildFleetScreenView(snapshot, "nobody").overBaseShips).toEqual([]);
  });

  it("reads 'not configured' without presence rules and the measured areas with them (S-5 09)", () => {
    // FIXTURE-CLASS rules: mechanics only, never a production value.
    const rules = {
      requiredTonsPerPossessionWeight: 100,
      noPortValueWeight: 2,
      crampedOrShortRangeCountBp: 5_000,
    };
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk" })], [], {
      world: {
        areas: [],
        routes: [],
        ports: [],
        possessions: [{ id: "p1", nationId: "uk", areaId: "india" }],
      },
    });
    expect(buildFleetScreenView(snapshot, "uk").presence).toEqual({ configured: false });
    expect(
      buildFleetScreenView(snapshot, "uk", { month: { month: 1, year: 1880 }, rules }).presence,
    ).toEqual({
      configured: true,
      exempt: false,
      areas: [{ areaId: "india", requiredTons: 200, presentTons: 0, shortfallTons: 200 }],
    });
    expect(buildFleetScreenView(snapshot, "nobody").presence).toEqual({ configured: false });
  });

  it("lists the world areas, routes as directed edges, and only the player's ports with level capacity", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          fleets: [makeFleet("fleet_gbr_home", "Home Fleet", [], "eng_home_coast")],
        }),
      ],
      [],
      {
        world: {
          areas: [
            {
              id: "eng_home_coast",
              name: "English Home Waters",
              type: "coastal",
              controller: "uk",
            },
            { id: "sea_english_channel", name: "English Channel", type: "sea" },
          ],
          routes: [
            {
              id: "r_chan_gib",
              from: "sea_english_channel",
              to: "eng_home_coast",
              type: "sea",
              distance: SafeInt(17),
            },
          ],
          ports: [
            {
              id: "gbr_portsmouth",
              name: "Portsmouth",
              areaId: "eng_home_coast",
              nationId: "uk",
              level: SafeInt(10),
            },
            {
              id: "fra_brest",
              name: "Brest",
              areaId: "fra_chan_coast",
              nationId: "france",
              level: SafeInt(9),
            },
          ],
        },
      },
    );

    const view = buildFleetScreenView(snapshot, "uk");
    expect(view.areas).toEqual([
      { id: "eng_home_coast", name: "English Home Waters" },
      { id: "sea_english_channel", name: "English Channel" },
    ]);
    expect(view.areaEdges).toEqual([
      { fromAreaId: "sea_english_channel", toAreaId: "eng_home_coast" },
    ]);
    // Only the player's own port, capacity = authored level.
    expect(view.ports).toEqual([
      { id: "gbr_portsmouth", name: "Portsmouth", areaId: "eng_home_coast", capacity: 10 },
    ]);
  });

  it("returns an empty view for an unknown player slot", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        fleets: [makeFleet("fleet_gbr_home", "Home Fleet", [], "eng_home_coast")],
      }),
    ]);
    expect(buildFleetScreenView(snapshot, "no-such-nation")).toEqual({
      divisions: [],
      areas: [],
      areaEdges: [],
      ports: [],
      presence: { configured: false },
      overBaseShips: [],
    });
  });
});
