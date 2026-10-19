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
      obligations: 500,
      researchRequested: 800,
      researchCap: 600,
      plannedConstruction: 1000,
      projectedNet: 1200,
      shortfall: 0,
      status: "healthy",
      monthEndTreasury: 51200,
    },
    fleet: [
      {
        name: "Home",
        divisions: [
          {
            name: "Home",
            areaId: "a_home",
            ships: [
              { name: "A", designId: "d", readiness: "ACTIVE", crewQuality: 100 },
              { name: "B", designId: "d", readiness: "ACTIVE", crewQuality: 100 },
            ],
          },
        ],
      },
      {
        name: "Far",
        divisions: [
          {
            name: "Far",
            areaId: "a_foreign",
            ships: [{ name: "C", designId: "d", readiness: "ACTIVE", crewQuality: 100 }],
          },
          {
            name: "Sea",
            areaId: "a_sea",
            ships: [{ name: "D", designId: "d", readiness: "ACTIVE", crewQuality: 100 }],
          },
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
  it("derives the budget rows from the projection, with expenses as the sum of its committed lines", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: 2 });
    const rows = Object.fromEntries(strip.budget.map((r) => [r.id, r]));
    expect(rows["treasury"]?.value).toBe("£50,000");
    expect(rows["monthly-budget"]?.label).toBe("Monthly appropriation");
    expect(rows["monthly-budget"]?.value).toBe("£5,000");
    // The old "revenue source is not yet confirmed" footnote is gone: the figure is the credited revenue.
    expect(rows["monthly-budget"]?.note).toBe("");
    expect(rows["obligations"]?.value).toBe("£500");
    expect(rows["maintenance"]?.value).toBe("£2,000");
    expect(rows["research"]?.value).toBe("£800");
    expect(rows["construction"]?.label).toBe("Construction (up to)");
    expect(rows["construction"]?.value).toBe("£1,000");
    // Construction is a bound, not a commitment: it is not in the total.
    expect(rows["total-expenses"]?.value).toBe("£3,300");
    expect(rows["balance"]?.value).toBe("£1,200");
    expect(rows["balance"]?.status).toBe("Healthy");
    expect(rows["shortfall"]).toBeUndefined();
    expect(rows["runway"]).toBeUndefined();
  });

  it("marks a negative balance with the shared status band, a shortfall and a runway", () => {
    const base = projection();
    const strip = buildStatusStrip({
      projection: projection({
        projectedSurplusDeficit: -450,
        economy: {
          ...base.economy,
          projectedNet: -450,
          status: "deficit",
          shortfall: 30,
          runwayMonths: 7,
        },
      }),
      areas,
      alertsCount: 0,
    });
    const balance = strip.budget.find((r) => r.id === "balance");
    expect(balance?.value).toBe("-£450");
    expect(balance?.tone).toBe("alert");
    expect(balance?.status).toBe("Deficit");
    expect(strip.summary.balance.status).toBe("Deficit");
    expect(strip.budget.find((r) => r.id === "shortfall")?.value).toBe("£30");
    expect(strip.budget.find((r) => r.id === "runway")?.value).toBe("7 months");
    expect(strip.budget.find((r) => r.id === "treasury")?.tone).toBe("normal");
  });

  it("explains an unpaid research budget on the research row", () => {
    const base = projection();
    const strip = buildStatusStrip({
      projection: projection({
        economy: {
          ...base.economy,
          researchSpend: 0,
          researchUnfundedReason: "ABOVE_CAP",
        },
      }),
      areas,
      alertsCount: 0,
    });
    expect(strip.budget.find((r) => r.id === "research")?.note).toMatch(/above the cap of 600/);
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
      balance: { value: "£1,200", status: "Healthy", tone: "normal" },
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

  it("splits the appropriation into committed lines with their share of it", () => {
    const { allocation } = buildStatusStrip({ projection: projection(), areas, alertsCount: 0 });
    expect(allocation.appropriation).toBe("£5,000");
    expect(allocation.segments.map((s) => [s.id, s.kind, s.value, s.percent])).toEqual([
      ["obligations", "committed", "£500", "10%"],
      ["maintenance", "committed", "£2,000", "40%"],
      ["research", "committed", "£800", "16%"],
      ["construction", "planned", "£1,000", "20%"],
    ]);
    expect(allocation.committed).toEqual({ value: "£3,300", percent: "66%" });
    expect(allocation.overCommitted).toBe(false);
  });

  it("sizes bar segments as fractions of one scale that never exceeds 1", () => {
    const { allocation } = buildStatusStrip({ projection: projection(), areas, alertsCount: 0 });
    const total = allocation.segments.reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeCloseTo(0.86, 5);
    expect(allocation.segments.every((s) => s.fraction >= 0 && s.fraction <= 1)).toBe(true);
  });

  it("rescales to the commitments and flags over-commitment when they exceed the appropriation", () => {
    const base = projection();
    const { allocation } = buildStatusStrip({
      projection: projection({ economy: { ...base.economy, monthlyAppropriation: 2000 } }),
      areas,
      alertsCount: 0,
    });
    expect(allocation.overCommitted).toBe(true);
    expect(allocation.committed.percent).toBe("165%");
    expect(allocation.segments.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1, 5);
  });

  it("shows no percentages, and empty bars, when there is no appropriation", () => {
    const base = projection();
    const { allocation } = buildStatusStrip({
      projection: projection({
        economy: {
          ...base.economy,
          monthlyAppropriation: 0,
          obligations: 0,
          maintenanceCost: 0,
          researchSpend: 0,
          plannedConstruction: 0,
        },
      }),
      areas,
      alertsCount: 0,
    });
    expect(allocation.segments.every((s) => s.percent === "—" && s.fraction === 0)).toBe(true);
    expect(allocation.committed.percent).toBe("—");
    expect(allocation.overCommitted).toBe(false);
  });

  it("names the nation for the panel header", () => {
    const strip = buildStatusStrip({ projection: projection(), areas, alertsCount: 0 });
    expect(strip.nationName).toBe("Britain");
  });

  const withEconomy = (patch: Partial<PlayerProjection["economy"]>) => {
    const base = projection();
    return buildStatusStrip({
      projection: projection({ economy: { ...base.economy, ...patch } }),
      areas,
      alertsCount: 0,
    }).allocation;
  };

  it("is not over-committed when committed lines exactly equal the appropriation", () => {
    const a = withEconomy({ monthlyAppropriation: 3300 });
    expect(a.overCommitted).toBe(false);
    expect(a.committed.percent).toBe("100%");
  });

  it("judges over-commitment on committed lines only, never on the construction bound", () => {
    // Committed £3,300 fits in £3,500 even though committed + construction (£4,300) does not.
    const a = withEconomy({ monthlyAppropriation: 3500 });
    expect(a.overCommitted).toBe(false);
  });

  it("is over-committed when there is no appropriation but there are committed lines", () => {
    expect(withEconomy({ monthlyAppropriation: 0 }).overCommitted).toBe(true);
    expect(withEconomy({ monthlyAppropriation: Number.NaN }).overCommitted).toBe(false);
  });

  it("never rounds a non-zero amount down to 0%", () => {
    const a = withEconomy({ monthlyAppropriation: 100000, obligations: 20, researchSpend: 3 });
    const pct = Object.fromEntries(a.segments.map((s) => [s.id, s.percent]));
    expect(pct["obligations"]).toBe("<1%");
    expect(pct["research"]).toBe("<1%");
    expect(a.segments.find((s) => s.id === "obligations")?.fraction).toBeGreaterThan(0);
  });

  it("keeps a missing (non-finite) line missing: no figure, no width, not counted", () => {
    const a = withEconomy({ researchSpend: Number.NaN });
    const research = a.segments.find((s) => s.id === "research");
    expect(research).toMatchObject({ value: "—", percent: "—", fraction: 0 });
    expect(a.committed.value).toBe("£2,500");
    expect(a.segments.every((s) => Number.isFinite(s.fraction))).toBe(true);
  });

  it("treats an invalid appropriation as none: no percentages, bounded finite widths", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      const a = withEconomy({ monthlyAppropriation: bad });
      expect(a.segments.every((s) => s.percent === "—")).toBe(true);
      expect(a.committed.percent).toBe("—");
      for (const s of a.segments) {
        expect(Number.isFinite(s.fraction)).toBe(true);
        expect(s.fraction).toBeGreaterThanOrEqual(0);
        expect(s.fraction).toBeLessThanOrEqual(1);
      }
    }
  });

  it("clamps a negative line's bar width to zero without hiding its true amount", () => {
    const seg = withEconomy({ obligations: -200 }).segments.find((s) => s.id === "obligations");
    expect(seg?.fraction).toBe(0);
    expect(seg?.value).toBe("-£200");
  });

  it("keeps the bar bounded and the legend honest for very large values", () => {
    const a = withEconomy({
      monthlyAppropriation: 1,
      obligations: 9_000_000_000_000,
      maintenanceCost: 9_000_000_000_000,
    });
    expect(a.segments.reduce((n, s) => n + s.fraction, 0)).toBeLessThanOrEqual(1 + 1e-9);
    expect(a.overCommitted).toBe(true);
    expect(a.committed.percent).toMatch(/^\d+%$/);
  });
});
