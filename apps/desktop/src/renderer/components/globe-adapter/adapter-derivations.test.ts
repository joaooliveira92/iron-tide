import { describe, expect, it } from "vite-plus/test";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";

function overlay() {
  return {
    ...EMPTY_LIVE_OVERLAY,
    source: "campaign" as const,
    ownership: new Map([
      ["area_north_sea", "united_kingdom"],
      ["area_western_approaches", "france"],
    ]),
    ports: [
      {
        id: "port-london",
        name: "London",
        area: "area_north_sea",
        nation: "united_kingdom",
        level: 8,
      },
    ],
    fleets: [
      {
        id: "fleet-home",
        name: "Home Fleet",
        area: "area_north_sea",
        nation: "united_kingdom",
        ships: 12,
      },
    ],
    lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
    campaignAreas: [],
  };
}

describe("adapter derivations", () => {
  it("lists every area for keyboard access, with ownership and ship strength", () => {
    const model = deriveAdapterModel(overlay(), "area_north_sea");
    expect(model.ownershipRows.length).toBeGreaterThan(30);
    const northSea = model.ownershipRows.find((row) => row.id === "area_north_sea");
    expect(northSea).toMatchObject({
      name: "North Sea",
      owner: "united_kingdom",
      fleets: 1,
      possessions: 1,
      selected: true,
      strength: "12 ships",
      unavailable: false,
    });
    expect(model.describeAreaFor("area_north_sea")).toContain("North Sea");
  });

  it("builds the selected area summary with its neighbours and fleets", () => {
    const model = deriveAdapterModel(overlay(), "area_north_sea");
    expect(model.summary?.name).toBe("North Sea");
    expect(model.summary?.fleets.map((fleet) => fleet.id)).toEqual(["fleet-home"]);
    expect(model.summary?.neighbours.map((neighbour) => neighbour.id)).toEqual([
      "area_western_approaches",
    ]);
  });

  it("marks areas with no campaign ownership as unavailable", () => {
    const model = deriveAdapterModel(overlay(), null);
    expect(model.ownershipRows.find((row) => row.id === "area_north_sea")?.unavailable).toBe(false);
    expect(model.ownershipRows.find((row) => row.id === "area_central_pacific")?.unavailable).toBe(
      true,
    );
  });
});
