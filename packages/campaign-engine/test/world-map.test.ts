import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { FleetState, Ship } from "@bluewave/campaign";
import { buildWorldMapView } from "../src/world-map.js";
import { fixtureNation, fixtureSnapshot } from "./fixtures.js";

/**
 * Pure projection tests for the full-world map view, mirroring
 * `fleet.test.ts`'s fixture pattern: hand-built snapshots, no compiler run.
 */

function makeShip(id: string, name: string): Ship {
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
  };
}

function makeFleet(id: string, name: string, ships: Ship[], locationAreaId: string): FleetState {
  return { id, nationId: "uk", name, ships, locationAreaId };
}

describe("buildWorldMapView", () => {
  it("exposes every nation, area, port, and fleet across all nations", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          name: "Britain",
          tag: "GBR",
          fleets: [
            makeFleet(
              "fleet_gbr_home",
              "Home Fleet",
              [
                makeShip("gbr_dreadnought", "HMS Dreadnought"),
                makeShip("gbr_inflexible", "HMS Inflexible"),
              ],
              "eng_home_coast",
            ),
          ],
        }),
        fixtureNation({
          id: "france",
          name: "France",
          tag: "FRA",
          fleets: [
            makeFleet(
              "fleet_fra_med",
              "Escadre",
              [makeShip("fra_redoutable", "Redoutable")],
              "fra_med_coast",
            ),
          ],
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
            {
              id: "fra_med_coast",
              name: "French Mediterranean",
              type: "coastal",
              controller: "france",
            },
          ],
          routes: [],
          ports: [
            {
              id: "gbr_portsmouth",
              name: "Portsmouth",
              areaId: "eng_home_coast",
              nationId: "uk",
              level: SafeInt(10),
            },
            {
              id: "fra_toulon",
              name: "Toulon",
              areaId: "fra_med_coast",
              nationId: "france",
              level: SafeInt(9),
            },
          ],
        },
      },
    );

    const view = buildWorldMapView(snapshot);

    expect(view.nations).toEqual([
      { id: "france", name: "France", tag: "FRA", homeAreaId: null, presenceAreaIds: [] },
      { id: "uk", name: "Britain", tag: "GBR", homeAreaId: null, presenceAreaIds: [] },
    ]);

    expect(view.areas).toEqual([
      { id: "eng_home_coast", name: "English Home Waters", type: "coastal", controller: "uk" },
      { id: "fra_med_coast", name: "French Mediterranean", type: "coastal", controller: "france" },
      { id: "sea_english_channel", name: "English Channel", type: "sea", controller: null },
    ]);

    expect(view.ports).toEqual([
      { id: "fra_toulon", name: "Toulon", areaId: "fra_med_coast", nationId: "france", level: 9 },
      {
        id: "gbr_portsmouth",
        name: "Portsmouth",
        areaId: "eng_home_coast",
        nationId: "uk",
        level: 10,
      },
    ]);

    expect(view.fleets).toEqual([
      {
        id: "fleet_fra_med",
        nationId: "france",
        name: "Escadre",
        areaId: "fra_med_coast",
        shipCount: 1,
      },
      {
        id: "fleet_gbr_home",
        nationId: "uk",
        name: "Home Fleet",
        areaId: "eng_home_coast",
        shipCount: 2,
      },
    ]);
  });

  it("renders an unclaimed area controller as null", () => {
    const snapshot = fixtureSnapshot([], [], {
      world: {
        areas: [{ id: "sea_north_sea", name: "North Sea", type: "sea" }],
        routes: [],
        ports: [],
      },
    });

    const view = buildWorldMapView(snapshot);
    expect(view.areas).toEqual([
      { id: "sea_north_sea", name: "North Sea", type: "sea", controller: null },
    ]);
  });
});

describe("buildWorldMapView home and presence areas (S-5 02)", () => {
  const snapshotWith = (possessions: { id: string; nationId: string; areaId: string }[]) =>
    fixtureSnapshot(
      [
        fixtureNation({ id: "uk", homeAreaId: "eng_home_coast" }),
        fixtureNation({ id: "france", homeAreaId: "fra_chan_coast" }),
      ],
      [],
      { world: { areas: [], routes: [], ports: [], possessions } },
    );
  const held = [
    { id: "p_malta", nationId: "uk", areaId: "med_malta" },
    { id: "p_home", nationId: "uk", areaId: "eng_home_coast" },
    { id: "p_chan", nationId: "france", areaId: "fra_chan_coast" },
  ];

  it("lists each nation's home area and its distinct possession areas ordered by area id", () => {
    const { nations } = buildWorldMapView(snapshotWith(held));
    expect(nations.find((n) => n.id === "uk")).toMatchObject({
      homeAreaId: "eng_home_coast",
      presenceAreaIds: ["eng_home_coast", "med_malta"],
    });
    expect(nations.find((n) => n.id === "france")).toMatchObject({
      homeAreaId: "fra_chan_coast",
      presenceAreaIds: ["fra_chan_coast"],
    });
  });

  it("changes the presence areas when a possession changes hands", () => {
    const ceded = held.map((p) => (p.id === "p_malta" ? { ...p, nationId: "france" } : p));
    const { nations } = buildWorldMapView(snapshotWith(ceded));
    expect(nations.find((n) => n.id === "uk")?.presenceAreaIds).toEqual(["eng_home_coast"]);
    expect(nations.find((n) => n.id === "france")?.presenceAreaIds).toEqual([
      "fra_chan_coast",
      "med_malta",
    ]);
  });

  it("exposes the compiled routes in id order, with their distance as a plain number", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "uk", name: "Britain", tag: "GBR" })],
      [],
      {
        world: {
          areas: [],
          ports: [],
          routes: [
            { id: "r_b", from: "sea_b", to: "sea_c", type: "sea", distance: SafeInt(2400) },
            { id: "r_a", from: "sea_a", to: "sea_b", type: "sea", distance: SafeInt(1700) },
            { id: "r_rail", from: "inland_a", to: "inland_b", type: "rail", distance: SafeInt(90) },
          ],
        },
      },
    );

    expect(buildWorldMapView(snapshot).routes).toEqual([
      { id: "r_a", from: "sea_a", to: "sea_b", type: "sea", distance: 1700 },
      { id: "r_b", from: "sea_b", to: "sea_c", type: "sea", distance: 2400 },
      { id: "r_rail", from: "inland_a", to: "inland_b", type: "rail", distance: 90 },
    ]);
  });
});
