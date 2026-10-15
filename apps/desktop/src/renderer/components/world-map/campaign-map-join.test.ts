import { describe, expect, it } from "vite-plus/test";
import type { WorldMapView } from "@bluewave/campaign-engine";
import { fixtureAreaId, nationHomeArea } from "../../content/presentationContent.js";
import { fixtureAnchor, homeFocusPoint, joinWorldMap } from "./campaign-map-join.js";

/**
 * Join tests: the campaign world (ids from the production pack) must land on the
 * fixture's 36-area geometry deterministically. The authored join itself is
 * validated at the artifact boundary (every production area has a region and a
 * fixture mapping; see the content compiler's presentation validation), so these
 * tests cover the runtime behaviour over the injected corpus.
 */

const WORLD: WorldMapView = {
  nations: [{ id: "uk", name: "Britain", tag: "GBR" }],
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
      },
    ]);
    expect(overlay.fleets).toEqual([
      {
        id: "fleet_gbr_home",
        name: "Home Fleet",
        area: "area_north_sea",
        nation: "uk",
        ships: 3,
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
  it("returns the mapped fixture anchor for a home area", () => {
    // eng_home_coast is drawn on the North Sea polygon; its label is the focus point.
    expect(homeFocusPoint("eng_home_coast")).toEqual(fixtureAnchor("area_north_sea"));
    const point = homeFocusPoint("eng_home_coast");
    expect(point).not.toBeNull();
    expect(point!.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("centres nowhere for an unknown or unmapped area rather than guessing", () => {
    expect(homeFocusPoint("not_a_real_area")).toBeNull();
    expect(homeFocusPoint(null)).toBeNull();
  });
});
