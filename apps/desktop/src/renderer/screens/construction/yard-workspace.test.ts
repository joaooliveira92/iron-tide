import { describe, expect, it } from "vite-plus/test";
import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import {
  catalogShipTypes,
  catalogView,
  designFit,
  dockGauge,
  railMarks,
  statusMeta,
} from "./yard-workspace.js";
import type { ProjectRow } from "./project-progress.js";

const economy = {
  treasury: 1000,
  monthlyAppropriation: 100,
  shipyardCapacity: 50,
  dockMaxBuildDisplacementKg: 13_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 2_000_000,
  exemptNewConstructionMassKg: 8_000_000,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: 1_000_000,
  dockPossessions: [],
};

const design = (id: string, over: Record<string, unknown> = {}) =>
  createCompiledDesignVersion(id, {
    className: id,
    shipType: "destroyer",
    nationId: "uk",
    year: 1880,
    available: true,
    mass: 1000,
    speed: 20,
    machineryType: "steam_turbine",
    requiredTechnologyIds: [],
    projectedCost: 100,
    projectedCapacityUnits: 10,
    costBasis: "displacement_formula",
    ...over,
  });

const project = (status: string): ProjectRow => ({
  projectId: status,
  className: status,
  shipType: "destroyer",
  status: status as ProjectRow["status"],
  percent: 10,
  yard: null,
  packages: [],
  holdUntilMonth: null,
  isForeign: false,
  readout: null,
});

describe("dockGauge", () => {
  it("scales used tonnage and the largest hull against the concurrency cap", () => {
    const gauge = dockGauge(economy);
    expect(gauge.usedPct).toBeCloseTo(5.128, 2);
    expect(gauge.hullPct).toBeCloseTo(33.333, 2);
    expect(gauge.freeKg).toBe(37_000_000);
    expect(gauge.over).toBe(false);
  });

  it("flags tonnage over the cap and clamps the bar", () => {
    const gauge = dockGauge({ ...economy, committedNewConstructionMassKg: 50_000_000 });
    expect(gauge.over).toBe(true);
    expect(gauge.usedPct).toBe(100);
    expect(gauge.freeKg).toBe(0);
  });

  it("has no hull marker without a dock", () => {
    expect(dockGauge({ ...economy, dockMaxBuildDisplacementKg: null }).hullPct).toBeNull();
  });
});

describe("designFit", () => {
  const workspace = { commands: [], treasuryReserved: 900, capacityReserved: 0 };

  it("compares the hull to the dock and the cost to the free treasury", () => {
    const fit = designFit(design("a", { mass: 20_000 }), economy, workspace);
    expect(fit.overDock).toBe(true);
    expect(fit.freeTreasury).toBe(100);
    expect(fit.affordable).toBe(true);
    expect(designFit(design("b", { projectedCost: 101 }), economy, workspace).affordable).toBe(
      false,
    );
  });

  it("does not claim a dock verdict when there is no dock", () => {
    const fit = designFit(design("a"), { ...economy, dockMaxBuildDisplacementKg: null }, workspace);
    expect(fit.dockPct).toBeNull();
    expect(fit.overDock).toBe(false);
  });
});

describe("catalogView", () => {
  const designs = [
    design("Beta", { year: 1890, projectedCost: 300 }),
    design("Alpha", { year: 1900, projectedCost: 200, shipType: "cruiser" }),
    design("Gamma", { year: 1910, available: false }),
  ];

  it("lists ship types once, sorted", () => {
    expect(catalogShipTypes(designs)).toEqual(["cruiser", "destroyer"]);
  });

  it("sorts, filters, and keeps unavailable designs last", () => {
    expect(catalogView(designs, null, "year").map((d) => d.className)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(catalogView(designs, null, "cost").map((d) => d.className)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(catalogView(designs, "cruiser", "name").map((d) => d.className)).toEqual(["Alpha"]);
  });
});

describe("railMarks", () => {
  it("counts ships, available designs and orders awaiting the month, and alerts on an over-cap dock", () => {
    const marks = railMarks({
      projects: [project("ACTIVE"), project("HALTED"), project("COMPLETED")],
      designs: [design("a"), design("b", { available: false })],
      commands: [],
      economy: { ...economy, committedNewConstructionMassKg: 40_000_000 },
    });
    expect(marks.slipways).toMatchObject({ text: "2", tone: "attention" });
    expect(marks.catalog.text).toBe("1");
    expect(marks.orders).toMatchObject({ text: "0", tone: "quiet" });
    expect(marks.dock.tone).toBe("alert");
  });
});

describe("statusMeta", () => {
  it("tones held statuses apart from live ones, and tolerates an unknown status", () => {
    expect(statusMeta("HALTED").tone).toBe("held");
    expect(statusMeta("ACCELERATED").tone).toBe("fast");
    expect(statusMeta("SOMETHING_NEW")).toEqual({ label: "something new", tone: "live" });
  });
});
