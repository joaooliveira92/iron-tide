import { describe, expect, it } from "vite-plus/test";
import { buildAreaOverview } from "./fleet-screen-state.js";

const areas = [
  { id: "a_malta", name: "Malta" },
  { id: "a_home", name: "English Home Waters" },
  { id: "a_cape", name: "Cape of Good Hope" },
];

describe("buildAreaOverview", () => {
  it("lists areas by name with the player's ports, fleets and borders", () => {
    const rows = buildAreaOverview(
      areas,
      [{ fromAreaId: "a_home", toAreaId: "a_malta" }],
      [
        { name: "Valletta", areaId: "a_malta" },
        { name: "Portsmouth", areaId: "a_home" },
        { name: "Plymouth", areaId: "a_home" },
      ],
      [
        { fleetName: "Home Fleet", areaId: "a_home" },
        { fleetName: "Mediterranean Fleet", areaId: "a_malta" },
      ],
    );
    expect(rows.map((r) => r.name)).toEqual(["Cape of Good Hope", "English Home Waters", "Malta"]);
    expect(rows[1]).toEqual({
      areaId: "a_home",
      name: "English Home Waters",
      ports: ["Plymouth", "Portsmouth"],
      divisions: ["Home Fleet"],
      neighbours: ["Malta"],
    });
    expect(rows[2]?.neighbours).toEqual(["English Home Waters"]);
  });

  it("gives an area with nothing in it empty lists, not missing data", () => {
    const [cape] = buildAreaOverview(areas, [], [], []);
    expect(cape).toMatchObject({
      name: "Cape of Good Hope",
      ports: [],
      divisions: [],
      neighbours: [],
    });
  });

  it("falls back to the id for a neighbour with no known name", () => {
    const rows = buildAreaOverview(
      [{ id: "a", name: "A" }],
      [{ fromAreaId: "a", toAreaId: "mystery" }],
      [],
      [],
    );
    expect(rows[0]?.neighbours).toEqual(["mystery"]);
  });

  it("returns no rows when there are no areas", () => {
    expect(buildAreaOverview([], [], [], [])).toEqual([]);
  });
});
