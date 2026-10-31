import { describe, expect, it } from "vite-plus/test";
import type { WorldMapView } from "@bluewave/campaign-engine";
import { fixtureAreaId, nationHomeArea } from "../../content/presentationContent.js";
import { AREA_ANCHORS, PORT_ANCHORS } from "./campaign-anchors.js";
import { homeFocusPoint, joinWorldMap } from "./campaign-map-join.js";

const WORLD: WorldMapView = {
  nations: [{ id: "uk", name: "Britain", tag: "GBR", homeAreaId: null, presenceAreaIds: [] }],
  areas: [
    { id: "sea_north_sea", name: "North Sea", type: "sea", controller: "uk" },
    { id: "eng_home_coast", name: "English Home Waters", type: "coastal", controller: "uk" },
    { id: "sea_english_channel", name: "English Channel", type: "sea", controller: null },
  ],
  ports: [
    {
      id: "gbr_portsmouth",
      name: "Portsmouth",
      areaId: "eng_home_coast",
      nationId: "uk",
      level: 10,
    },
  ],
  fleets: [
    {
      id: "fleet_gbr_home",
      nationId: "uk",
      name: "Home Fleet",
      areaId: "eng_home_coast",
      shipCount: 3,
    },
  ],
  routes: [],
};

describe("joinWorldMap", () => {
  it("maps campaign areas onto fixture geometry and records their controller", () => {
    const overlay = joinWorldMap(WORLD);
    expect(overlay.ownership.get("area_north_sea")).toBe("uk");
    expect(overlay.ownership.get("area_western_approaches")).toBe(null);
    expect(overlay.ownership.get("area_mediterranean")).toBeUndefined();
  });

  it("places campaign ports and fleets on their mapped fixture area", () => {
    const overlay = joinWorldMap(WORLD);
    expect(overlay.ports).toEqual([
      {
        id: "gbr_portsmouth",
        name: "Portsmouth",
        area: "area_north_sea",
        nation: "uk",
        level: 10,
        anchor: PORT_ANCHORS["gbr_portsmouth"],
      },
    ]);
    expect(overlay.fleets).toEqual([
      {
        id: "fleet_gbr_home",
        name: "Home Fleet",
        area: "area_north_sea",
        nation: "uk",
        ships: 3,
        anchor: AREA_ANCHORS["eng_home_coast"],
      },
    ]);
  });

  it("drops campaign data with no fixture mapping instead of guessing", () => {
    const unknown = joinWorldMap({
      ...WORLD,
      fleets: [
        {
          id: "fleet_nowhere",
          nationId: "uk",
          name: "Phantom Fleet",
          areaId: "not_a_real_area",
          shipCount: 1,
        },
      ],
    });
    expect(unknown.fleets).toEqual([]);
  });

  it("flags the source as campaign so the chart stops using the fixture", () => {
    expect(joinWorldMap(WORLD).source).toBe("campaign");
  });
});

describe("fixtureAreaId", () => {
  it("returns the polygon a campaign area is drawn on, or null when it has none", () => {
    expect(fixtureAreaId("eng_home_coast")).toBe("area_north_sea");
    expect(fixtureAreaId("not_a_real_area")).toBeNull();
  });
});

describe("nationHomeArea", () => {
  it("resolves a nation's home waters and degrades to null for unknown nations", () => {
    expect(nationHomeArea("uk")).toBe("eng_home_coast");
    expect(nationHomeArea("japan")).toBe("jpn_home_coast");
    expect(nationHomeArea("atlantis")).toBeNull();
    expect(nationHomeArea(null)).toBeNull();
  });
});

describe("homeFocusPoint", () => {
  it("returns the campaign anchor for a home area", () => {
    expect(homeFocusPoint("eng_home_coast")).toEqual(AREA_ANCHORS["eng_home_coast"]);
    const point = homeFocusPoint("eng_home_coast");
    expect(point).not.toBeNull();
    expect(point!.every((value) => Number.isFinite(value))).toBe(true);
  });
  it("centres nowhere for an unknown or unmapped area rather than guessing", () => {
    expect(homeFocusPoint("not_a_real_area")).toBeNull();
    expect(homeFocusPoint(null)).toBeNull();
  });
});

describe("joinWorldMap lanes", () => {
  const route = (id: string, from: string, to: string, type: "sea" | "land" | "rail" = "sea") => ({
    id,
    from,
    to,
    type,
    distance: 100,
  });

  it("turns compiled sea routes into lanes between the fixture areas they sit on", () => {
    const north = fixtureAreaId("sea_north_sea");
    const channel = fixtureAreaId("sea_english_channel");
    expect(north).not.toBeNull();
    expect(channel).not.toBeNull();
    const overlay = joinWorldMap({
      ...WORLD,
      routes: [route("r1", "sea_north_sea", "sea_english_channel")],
    });
    const wanted = [north as string, channel as string].sort();
    expect(overlay.lanes).toEqual(wanted[0] === wanted[1] ? [] : [{ a: wanted[0], b: wanted[1] }]);
  });

  it("drops land and rail links, self-pairs, duplicates and unmapped ends", () => {
    const overlay = joinWorldMap({
      ...WORLD,
      routes: [
        route("r_rail", "sea_north_sea", "sea_english_channel", "rail"),
        route("r_self", "sea_north_sea", "sea_north_sea"),
        route("r_ghost", "sea_north_sea", "no_such_area"),
        route("r_dup1", "sea_north_sea", "sea_atlantic_n"),
        route("r_dup2", "sea_atlantic_n", "sea_north_sea"),
      ],
    });
    expect(overlay.lanes?.length).toBeLessThanOrEqual(1);
    for (const lane of overlay.lanes ?? []) expect(lane.a < lane.b).toBe(true);
  });

  it("orders lanes by pair so the same campaign always draws the same lanes", () => {
    const routes = [
      route("r1", "sea_atlantic_n", "sea_north_sea"),
      route("r2", "sea_english_channel", "sea_mediterranean_w"),
      route("r3", "sea_arabian_sea", "africa_cape"),
    ];
    const forward = joinWorldMap({ ...WORLD, routes }).lanes ?? [];
    const backward = joinWorldMap({ ...WORLD, routes: [...routes].reverse() }).lanes ?? [];
    expect(backward).toEqual(forward);
    expect(forward.length).toBeGreaterThan(0);
  });
});
