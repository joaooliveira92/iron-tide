import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { FleetState, Officer, PermanentDivision, Ship } from "@bluewave/campaign";
import { VACANT } from "@bluewave/campaign";
import { buildDivisionScreenView } from "../src/division-screen.js";
import { fixtureNation, fixtureSnapshot } from "./fixtures.js";

function ship(id: string, name: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name,
    classId: "class_a",
    nationId: "uk",
    locationAreaId: "home",
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
    ...over,
  };
}

function fleet(id: string, areaId: string, ships: Ship[]): FleetState {
  return { id, nationId: "uk", name: id, ships, locationAreaId: areaId };
}

function division(over: Partial<PermanentDivision> & { divisionId: string }): PermanentDivision {
  return {
    nationId: "uk",
    shipOrder: ["s1", "s2"],
    flagshipShipId: "s1",
    commanderOfficerId: VACANT,
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "home",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "1.0",
    aggregateHash: "",
    ...over,
  };
}

function snapshot(fleets: FleetState[], divisions: PermanentDivision[], officers: Officer[] = []) {
  return fixtureSnapshot(
    [fixtureNation({ id: "uk", name: "Britain", fleets, divisions, officers })],
    [],
    {
      world: {
        areas: [
          { id: "home", name: "English Home Waters", type: "coastal" },
          { id: "malta", name: "Malta", type: "coastal" },
        ],
        routes: [],
        ports: [],
      } as never,
    },
  );
}

describe("buildDivisionScreenView: doctrine", () => {
  const fleets = (slow: number) => [
    fleet("f_home", "home", [
      ship("s1", "HMS Alexandra", { speed: SafeInt(17) }),
      ship("s2", "HMS Dreadnought", { speed: SafeInt(slow) }),
    ]),
  ];

  it("prices a role or formation change from the ruleset and shows none while dormant", () => {
    const withRules = buildDivisionScreenView(
      snapshot(fleets(17), [division({ divisionId: "div_1" })]),
      "uk",
      {
        roleChange: { cohesion: 10, experience: 2 },
        formationChange: { cohesion: 5, experience: 0 },
      },
    )!;
    expect(withRules.penalties.changeRole).toEqual({ experience: 2, cohesion: 10 });
    expect(withRules.penalties.changeFormation).toEqual({ experience: 0, cohesion: 5 });

    const dormant = buildDivisionScreenView(
      snapshot(fleets(17), [division({ divisionId: "div_1" })]),
      "uk",
    )!;
    expect(dormant.penalties.changeRole).toEqual({ experience: 0, cohesion: 0 });
    expect(dormant.penalties.changeFormation).toEqual({ experience: 0, cohesion: 0 });
  });

  it("derives a speed warning from the members' speeds and omits it for equal speeds", () => {
    const mismatched = buildDivisionScreenView(
      snapshot(fleets(12), [division({ divisionId: "div_1" })]),
      "uk",
    )!;
    expect(mismatched.divisions[0]!.speedWarning).toEqual({
      slowestShipName: "HMS Dreadnought",
      slowestSpeed: 12,
      fastestSpeed: 17,
    });
    const uniform = buildDivisionScreenView(
      snapshot(fleets(17), [division({ divisionId: "div_1" })]),
      "uk",
    )!;
    expect(uniform.divisions[0]!.speedWarning).toBeUndefined();
  });
});

describe("buildDivisionScreenView", () => {
  it("returns null for an unknown nation", () => {
    expect(buildDivisionScreenView(snapshot([], []), "nobody")).toBeNull();
  });

  it("starts with no divisions and every finished ship unassigned, grouped by location", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [
          fleet("f_home", "home", [ship("s1", "HMS Alexandra"), ship("s2", "HMS Dreadnought")]),
          fleet("f_med", "malta", [ship("s3", "HMS Temeraire")]),
        ],
        [],
      ),
      "uk",
    )!;
    expect(view.divisions).toEqual([]);
    expect(view.unassignedShips.map((s) => [s.shipId, s.name, s.areaId, s.areaName])).toEqual([
      ["s1", "HMS Alexandra", "home", "English Home Waters"],
      ["s2", "HMS Dreadnought", "home", "English Home Waters"],
      ["s3", "HMS Temeraire", "malta", "Malta"],
    ]);
  });

  it("describes a division with ship names, flagship, vacant commander and the real stats", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [fleet("f_home", "home", [ship("s1", "HMS Alexandra"), ship("s2", "HMS Dreadnought")])],
        [division({ divisionId: "div_1", experience: SafeInt(35), cohesion: SafeInt(60) })],
      ),
      "uk",
    )!;
    expect(view.divisions).toHaveLength(1);
    expect(view.divisions[0]).toMatchObject({
      divisionId: "div_1",
      role: "CORE",
      formation: "LINE_AHEAD",
      flagshipShipId: "s1",
      flagshipName: "HMS Alexandra",
      commanderVacant: true,
      experience: 35,
      cohesion: 60,
      areaId: "home",
      areaName: "English Home Waters",
    });
    expect(view.divisions[0]?.ships.map((s) => s.name)).toEqual([
      "HMS Alexandra",
      "HMS Dreadnought",
    ]);
    expect(view.unassignedShips).toEqual([]);
  });

  it("names the commanding officer and leaves the commander unset when vacant", () => {
    const officer = {
      id: "off_uk_1",
      name: "Edmund Harcourt",
      rank: "COMMODORE",
      skill: SafeInt(62),
    };
    const base = snapshot(
      [fleet("f_home", "home", [ship("s1", "HMS Alexandra"), ship("s2", "HMS Dreadnought")])],
      [
        division({ divisionId: "div_1", commanderOfficerId: "off_uk_1" }),
        division({ divisionId: "div_2", shipOrder: [], flagshipShipId: "none" }),
      ],
    );
    const nation = base.nations.get("uk")!;
    nation.officers = [officer as never];
    const view = buildDivisionScreenView(base, "uk")!;
    expect(view.divisions[0]).toMatchObject({
      commanderVacant: false,
      commander: { officerId: "off_uk_1", name: "Edmund Harcourt", rank: "COMMODORE", skill: 62 },
    });
    expect(view.divisions[1]?.commanderVacant).toBe(true);
    expect(view.divisions[1]?.commander).toBeUndefined();
  });

  it("never offers ships still under construction", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [
          fleet("f", "home", [
            ship("s1", "HMS Done"),
            ship("s2", "HMS Building", { isUnderConstruction: true }),
          ]),
        ],
        [],
      ),
      "uk",
    )!;
    expect(view.unassignedShips.map((s) => s.shipId)).toEqual(["s1"]);
  });

  it("never offers a ship that a rebuild has made unavailable, but does offer a degraded one", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [
          fleet("f", "home", [
            ship("s1", "HMS Ready"),
            ship("s2", "HMS Rebuilding", { availability: "UNAVAILABLE" }),
            ship("s3", "HMS Limping", { availability: "DEGRADED" }),
          ]),
        ],
        [],
      ),
      "uk",
    )!;
    expect(view.unassignedShips.map((s) => s.shipId)).toEqual(["s1", "s3"]);
  });

  it("lists the officer corps with the division each officer commands", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [],
        [
          division({ divisionId: "div_2", commanderOfficerId: "off_uk_3" }),
          division({ divisionId: "div_1", commanderOfficerId: "off_uk_1" }),
        ],
        [
          { id: "off_uk_3", name: "Hugh Fairfax", rank: "REAR_ADMIRAL", skill: SafeInt(88) },
          { id: "off_uk_1", name: "Edmund Harcourt", rank: "CAPTAIN", skill: SafeInt(41) },
          { id: "off_uk_2", name: "Charles Wyndham", rank: "COMMODORE", skill: SafeInt(63) },
        ],
      ),
      "uk",
    )!;
    expect(view.officers).toEqual([
      {
        officerId: "off_uk_1",
        name: "Edmund Harcourt",
        rank: "CAPTAIN",
        skill: 41,
        divisionId: "div_1",
      },
      {
        officerId: "off_uk_2",
        name: "Charles Wyndham",
        rank: "COMMODORE",
        skill: 63,
      },
      {
        officerId: "off_uk_3",
        name: "Hugh Fairfax",
        rank: "REAR_ADMIRAL",
        skill: 88,
        divisionId: "div_2",
      },
    ]);
  });

  it("reports an empty officer corps when the nation has none", () => {
    expect(buildDivisionScreenView(snapshot([], []), "uk")!.officers).toEqual([]);
  });

  it("exposes the engine's roles, formations and size limits instead of hard-coding them in the UI", () => {
    const view = buildDivisionScreenView(snapshot([], []), "uk")!;
    expect(view.roles).toEqual(["INDEPENDENT", "CORE", "SUPPORT", "SCOUT", "SCREEN", "PATROL"]);
    expect(view.formations).toEqual(["LINE_AHEAD", "LINE_ABREAST", "SEARCH_LINE", "SCREEN"]);
    expect(view.maxShips).toBe(5);
    expect(view.maxDestroyers).toBe(6);
  });

  it("states what a reorganization costs, from the engine's own constants", () => {
    const view = buildDivisionScreenView(snapshot([], []), "uk")!;
    expect(view.initial).toEqual({ experience: 20, cohesion: 30 });
    expect(view.penalties).toEqual({
      addShip: { experience: 5, cohesion: 10 },
      removeShip: { experience: 3, cohesion: 5 },
      changeFlagship: { experience: 5, cohesion: 10 },
      changeCommander: { experience: 5, cohesion: 10 },
      reorder: { experience: 0, cohesion: 3 },
      changeRole: { experience: 0, cohesion: 0 },
      changeFormation: { experience: 0, cohesion: 0 },
    });
  });

  it("falls back to ids for a ship or area it cannot name, never throwing", () => {
    const view = buildDivisionScreenView(
      snapshot(
        [],
        [
          division({
            divisionId: "div_x",
            locationAreaId: "nowhere",
            shipOrder: ["gone"],
            flagshipShipId: "gone",
          }),
        ],
      ),
      "uk",
    )!;
    expect(view.divisions[0]).toMatchObject({ areaName: "nowhere", flagshipName: "gone" });
    expect(view.divisions[0]?.ships).toEqual([{ shipId: "gone", name: "gone" }]);
  });

  it("orders ids by code unit, not by the host's locale (uppercase sorts before lowercase)", () => {
    const view = buildDivisionScreenView(
      snapshot([fleet("f", "home", [ship("a_ship", "A"), ship("B_ship", "B")])], []),
      "uk",
    )!;
    expect(view.unassignedShips.map((s) => s.shipId)).toEqual(["B_ship", "a_ship"]);
  });

  it("is deterministic: same snapshot, same view", () => {
    const snap = snapshot([fleet("f", "home", [ship("b", "B"), ship("a", "A")])], []);
    expect(buildDivisionScreenView(snap, "uk")).toEqual(buildDivisionScreenView(snap, "uk"));
  });
});
