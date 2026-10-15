import { describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { buildStatusStrip, type StatusStripAreas } from "./status-strip-state.js";

function projection(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    campaignIdentity: "c",
    snapshotHash: "h",
    revision: 1,
    month: { year: 1880, month: 1 },
    playerNationId: "uk",
    nationName: "Britain",
    projectedSurplusDeficit: 1200,
    economy: {
      treasury: 50000,
      monthlyAppropriation: 5000,
      shipyardCapacity: 7,
      constructionSpend: 1000,
      researchSpend: 800,
      maintenanceCost: 2000,
    },
    fleet: [
      {
        name: "Home",
        divisions: [
          {
            name: "Home",
            areaId: "a_home",
            ships: [
              { name: "A", designId: "d" },
              { name: "B", designId: "d" },
            ],
          },
        ],
      },
      {
        name: "Far",
        divisions: [
          { name: "Far", areaId: "a_foreign", ships: [{ name: "C", designId: "d" }] },
          { name: "Sea", areaId: "a_sea", ships: [{ name: "D", designId: "d" }] },
        ],
      },
    ],
    ports: [],
    knownTechnologyIds: [],
    strategicAreas: [{ id: "a_home", name: "Home waters" }],
    knownEnemyNations: [],
    commandWorkspace: { commands: [], movementCommands: [] },
    ...overrides,
  };
}

const areas: StatusStripAreas = [
  { id: "a_home", controller: "gbr" },
  { id: "a_foreign", controller: "fra" },
  { id: "a_sea", controller: null },
];

describe("buildStatusStrip", () => {
  it("derives the budget rows from the projection, with expenses as the sum of its lines", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: 2 });
    const rows = Object.fromEntries(strip.budget.map((r) => [r.id, r]));
    expect(rows["treasury"]?.value).toBe("£50,000");
    expect(rows["monthly-budget"]?.label).toBe("Monthly budget (projected)");
    expect(rows["monthly-budget"]?.value).toBe("£5,000");
    expect(rows["maintenance"]?.value).toBe("£2,000");
    expect(rows["construction"]?.label).toBe("Construction (committed)");
    expect(rows["research"]?.value).toBe("£800");
    expect(rows["total-expenses"]?.value).toBe("£3,800");
    expect(rows["balance"]?.value).toBe("£1,200");
  });

  it("marks a negative balance with text as well as a tone", () => {
    const strip = buildStatusStrip({
      projection: projection({ projectedSurplusDeficit: -450 }),
      areas,
      alertsCount: 0,
    });
    const balance = strip.budget.find((r) => r.id === "balance");
    expect(balance?.value).toBe("-£450");
    expect(balance?.tone).toBe("alert");
    expect(balance?.status).toBe("Deficit");
    expect(strip.summary.balance.status).toBe("Deficit");
    expect(strip.budget.find((r) => r.id === "treasury")?.tone).toBe("normal");
  });

  it("counts ships on foreign stations, excluding own and unclaimed areas", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: null });
    const row = strip.nation.find((r) => r.id === "foreign-stations");
    expect(row?.value).toBe("1 ship");
    expect(row?.note).toMatch(/not tonnage/i);
  });

  it("defers the foreign-station count when the map areas are unavailable", () => {
    const strip = buildStatusStrip({ projection: projection(), areas: null, alertsCount: null });
    expect(strip.nation.find((r) => r.id === "foreign-stations")?.deferred).toBe(true);
  });

  it("labels shipyard capacity as a port-level proxy", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: null });
    const row = strip.nation.find((r) => r.id === "shipyard-capacity");
    expect(row?.label).toBe("Shipyard capacity (port levels)");
    expect(row?.value).toBe("7");
  });

  it("lists every deferred readout as Not yet modelled with a reason, never a number", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: null });
    const deferredNation = strip.nation.filter((r) => r.deferred).map((r) => r.id);
    expect(deferredNation).toEqual([
      "prestige",
      "fleet-morale",
      "dock-size",
      "unrest",
      "build-requirement",
      "treaty-limits",
    ]);
    const deferredBudget = strip.budget.filter((r) => r.deferred).map((r) => r.id);
    expect(deferredBudget).toEqual(["naval-aircraft", "extra-training", "intelligence"]);
    for (const row of [...strip.nation, ...strip.budget].filter((r) => r.deferred)) {
      expect(row.value).toBe("Not yet modelled");
      expect(row.note.length).toBeGreaterThan(10);
    }
  });

  it("summarises balance, treasury and alerts for the compact one-liner", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: 3 });
    expect(strip.summary).toEqual({
      balance: { value: "£1,200", status: "Surplus", tone: "normal" },
      treasury: "£50,000",
      alerts: "3 alerts",
    });
    expect(
      buildStatusStrip({ projection: projection(), areas, alertsCount: 1 }).summary.alerts,
    ).toBe("1 alert");
    expect(
      buildStatusStrip({ projection: projection(), areas, alertsCount: null }).summary.alerts,
    ).toBe("Alerts unavailable");
  });

  it("collects every deferred row, in order, into deferredRows", () => {
    const strip = buildStatusStrip({ projection: projection(), areas: [], alertsCount: 0 });
    expect(strip.deferredRows.every((r) => r.deferred)).toBe(true);
    expect(strip.deferredRows.length).toBe(
      [...strip.nation, ...strip.budget].filter((r) => r.deferred).length,
    );
    expect(strip.deferredRows[0]?.id).toBe("prestige");
  });
});
