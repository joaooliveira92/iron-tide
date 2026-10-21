import { describe, expect, it } from "vite-plus/test";
import type {
  FleetDivisionView,
  FleetScreenProjection,
} from "../../../../shared/fleet-contract.js";
import {
  explainStationRejection,
  presenceReadout,
  stationRows,
  toggleSelection,
} from "./fleet-station-state.js";

const ship = (over: Partial<FleetDivisionView["ships"][number]> = {}) => ({
  shipId: "s1",
  name: "HMS One",
  designId: "d",
  status: "active",
  readiness: "ACTIVE",
  crewQuality: 80,
  ...over,
});
const division = (ships: FleetDivisionView["ships"]): FleetDivisionView => ({
  divisionId: "f1",
  fleetName: "Home",
  areaId: "home",
  ships,
});
const areaName = (id: string) => (id === "home" ? "Home Waters" : id);

describe("stationRows (manual p.48 codes, all conveyed as text)", () => {
  it("maps readiness to AF/RF/MB/WU with a text label", () => {
    const rows = stationRows(
      [
        division([
          ship({ shipId: "a", readiness: "ACTIVE" }),
          ship({ shipId: "b", readiness: "RESERVE" }),
          ship({ shipId: "c", readiness: "MOTHBALLED" }),
          ship({ shipId: "d", readiness: "WORKING_UP" }),
        ]),
      ],
      areaName,
    );
    expect(rows.map((r) => [r.statusCode, r.statusLabel])).toEqual([
      ["AF", "Active fleet"],
      ["RF", "Reserve fleet"],
      ["MB", "Mothballed"],
      ["WU", "Working up"],
    ]);
    expect(rows[0]!.areaName).toBe("Home Waters");
  });

  it("shows FS for a foreign-station ship, the month count for repair, and * as maintenance text", () => {
    const [fs, repair, , over] = stationRows(
      [
        division([
          ship({
            shipId: "fs",
            stationAssignment: "FOREIGN_STATION",
            stationCode: "FS",
          }),
          ship({ shipId: "r", readiness: "REPAIR", repairMonthsRemaining: 3 }),
          ship({ shipId: "r1", readiness: "REPAIR", repairMonthsRemaining: 1 }),
          ship({ shipId: "o", overBase: true, overBaseCode: "*" }),
        ]),
      ],
      areaName,
    );
    expect(fs).toMatchObject({
      statusCode: "FS",
      statusLabel: "On foreign station",
    });
    expect(repair).toMatchObject({
      statusCode: "3",
      statusLabel: "In repair for 3 more months",
    });
    expect(over).toMatchObject({ statusCode: "AF", overBase: true });
    expect(over!.overBaseLabel).toContain("Needs maintenance");
  });

  it("lists the c, a and S flags with labels, and none otherwise", () => {
    const [flagged, plain] = stationRows(
      [
        division([
          ship({
            shipId: "x",
            colonialCode: "c",
            colonialServiceFitted: true,
            crampedCode: "a",
            rangeCode: "S",
          }),
          ship({ shipId: "y" }),
        ]),
      ],
      areaName,
    );
    expect(flagged!.flags).toEqual([
      { code: "c", label: "Equipped for colonial service" },
      { code: "a", label: "Cramped accommodation" },
      { code: "S", label: "Short range" },
    ]);
    expect(plain!.flags).toEqual([]);
  });
});

describe("toggleSelection", () => {
  it("adds and removes, keeping a stable order", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("explainStationRejection", () => {
  const rows = stationRows([division([ship({ shipId: "s1", name: "HMS One" })])], areaName);
  it("names each ship and its typed reason in text", () => {
    const text = explainStationRejection(
      "assign",
      ["Foreign-station assign rejected: s1=NOT_ACTIVE, zz=NOT_OWNED"],
      rows,
    );
    expect(text).toEqual([
      "Assignment rejected. Nothing was queued.",
      "HMS One is not on active service; only active-fleet ships can be assigned.",
      "zz is not one of your ships.",
    ]);
  });
  it("falls back to the raw code for an unknown reason and the raw message when unparseable", () => {
    expect(explainStationRejection("clear", ["x: s1=WEIRD"], rows)).toEqual([
      "Clearing rejected. Nothing was queued.",
      "HMS One was rejected (WEIRD).",
    ]);
    expect(explainStationRejection("clear", ["stale snapshot"], rows)).toEqual([
      "Clearing rejected. Nothing was queued.",
      "stale snapshot",
    ]);
  });
});

describe("presenceReadout (projection only)", () => {
  const base = { overBaseShips: [] } as Pick<FleetScreenProjection, "overBaseShips">;
  it("is 'not configured' for a dormant section", () => {
    expect(presenceReadout({ configured: false }, base.overBaseShips, areaName)).toEqual({
      kind: "not-configured",
      overBase: [],
    });
  });
  it("reports required, present, shortfall and the exemption notice", () => {
    const readout = presenceReadout(
      {
        configured: true,
        exempt: true,
        areas: [
          {
            areaId: "home",
            requiredTons: 400,
            presentTons: 200,
            shortfallTons: 0,
          },
        ],
      },
      [{ shipId: "s", name: "HMS S", areaId: "home" }],
      areaName,
    );
    expect(readout).toMatchObject({
      kind: "configured",
      exempt: true,
      rows: [
        {
          areaName: "Home Waters",
          required: "400 t",
          present: "200 t",
          shortfall: "None (suspended)",
          short: false,
        },
      ],
      overBase: ["HMS S in Home Waters"],
    });
  });
  it("words a shortfall and a met requirement", () => {
    const readout = presenceReadout(
      {
        configured: true,
        exempt: false,
        areas: [
          {
            areaId: "a",
            requiredTons: 100,
            presentTons: 40,
            shortfallTons: 60,
          },
          {
            areaId: "b",
            requiredTons: 100,
            presentTons: 100,
            shortfallTons: 0,
          },
        ],
      },
      [],
      areaName,
    );
    if (readout.kind !== "configured") throw new Error("expected configured");
    expect(readout.rows.map((r) => [r.shortfall, r.short])).toEqual([
      ["60 t", true],
      ["None (requirement met)", false],
    ]);
  });
});
