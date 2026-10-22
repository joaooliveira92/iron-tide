import { describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { createPresentationFormat } from "../lib/presentation-format/index.js";
import {
  buildStatusStrip,
  type StatusStripAreas,
  type StatusStripInput,
} from "./status-strip-state.js";

/** The strip's figures under the default presentation (en-US, Naval Credits, imperial). */
const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const buildStrip = (input: Omit<StatusStripInput, "format">) =>
  buildStatusStrip({ ...input, format: FORMAT });

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
    const strip = buildStrip({ projection: projection(), areas, alertsCount: 2 });
    const rows = Object.fromEntries(strip.budget.map((r) => [r.id, r]));
    expect(rows["treasury"]?.value).toBe("50,000 NC");
    expect(rows["monthly-budget"]?.label).toBe("Monthly appropriation");
    expect(rows["monthly-budget"]?.value).toBe("5,000 NC");
    // The old "revenue source is not yet confirmed" footnote is gone: the figure is the credited revenue.
    expect(rows["monthly-budget"]?.note).toBe("");
    expect(rows["obligations"]?.value).toBe("500 NC");
    expect(rows["maintenance"]?.value).toBe("2,000 NC");
    expect(rows["research"]?.value).toBe("800 NC");
    expect(rows["construction"]?.label).toBe("Construction (up to)");
    expect(rows["construction"]?.value).toBe("1,000 NC");
    // Construction is a bound, not a commitment: it is not in the total.
    expect(rows["total-expenses"]?.value).toBe("3,300 NC");
    expect(rows["balance"]?.value).toBe("1,200 NC");
    expect(rows["balance"]?.status).toBe("Healthy");
    expect(rows["shortfall"]).toBeUndefined();
    expect(rows["runway"]).toBeUndefined();
  });

  it("marks a negative balance with the shared status band, a shortfall and a runway", () => {
    const base = projection();
    const strip = buildStrip({
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
    expect(balance?.value).toBe("-450 NC");
    expect(balance?.tone).toBe("alert");
    expect(balance?.status).toBe("Deficit");
    expect(strip.summary.balance.status).toBe("Deficit");
    expect(strip.budget.find((r) => r.id === "shortfall")?.value).toBe("30 NC");
    expect(strip.budget.find((r) => r.id === "runway")?.value).toBe("7 months");
    expect(strip.budget.find((r) => r.id === "treasury")?.tone).toBe("normal");
  });

  it("explains an unpaid research budget on the research row", () => {
    const base = projection();
    const strip = buildStrip({
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
    const strip = buildStrip({ projection: projection(), areas, alertsCount: null });
    const row = strip.nation.find((r) => r.id === "foreign-stations");
    // The fixture ships carry no displacement, so only the count is shown, never a made-up tonnage.
    expect(row?.value).toBe("1 ship");
    expect(row?.note).toMatch(/tonnage is shown when every one/i);
  });

  it("defers the foreign-station count when the map areas are unavailable", () => {
    const strip = buildStrip({ projection: projection(), areas: null, alertsCount: null });
    expect(strip.nation.find((r) => r.id === "foreign-stations")?.deferred).toBe(true);
  });

  it("labels shipyard capacity as a port-level proxy", () => {
    const strip = buildStrip({ projection: projection(), areas, alertsCount: null });
    const row = strip.nation.find((r) => r.id === "shipyard-capacity");
    expect(row?.label).toBe("Shipyard capacity (port levels)");
    expect(row?.value).toBe("7");
  });

  it("lists every deferred readout as Not yet modelled with a reason, never a number", () => {
    const strip = buildStrip({ projection: projection(), areas, alertsCount: null });
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
    const strip = buildStrip({ projection: projection(), areas, alertsCount: 3 });
    expect(strip.summary).toEqual({
      balance: { value: "1,200 NC", status: "Healthy", tone: "normal" },
      treasury: "50,000 NC",
      alerts: "3 alerts",
    });
    expect(buildStrip({ projection: projection(), areas, alertsCount: 1 }).summary.alerts).toBe(
      "1 alert",
    );
    expect(buildStrip({ projection: projection(), areas, alertsCount: null }).summary.alerts).toBe(
      "Alerts unavailable",
    );
  });

  it("collects every deferred row, in order, into deferredRows", () => {
    const strip = buildStrip({ projection: projection(), areas: [], alertsCount: 0 });
    expect(strip.deferredRows.every((r) => r.deferred)).toBe(true);
    expect(strip.deferredRows.length).toBe(
      [...strip.nation, ...strip.budget].filter((r) => r.deferred).length,
    );
    expect(strip.deferredRows[0]?.id).toBe("prestige");
  });

  it("splits the appropriation into committed lines with their share of it", () => {
    const { allocation } = buildStrip({ projection: projection(), areas, alertsCount: 0 });
    expect(allocation.appropriation).toBe("5,000 NC");
    expect(allocation.segments.map((s) => [s.id, s.kind, s.value, s.percent])).toEqual([
      ["obligations", "committed", "500 NC", "10%"],
      ["maintenance", "committed", "2,000 NC", "40%"],
      ["research", "committed", "800 NC", "16%"],
      ["construction", "planned", "1,000 NC", "20%"],
    ]);
    expect(allocation.committed).toEqual({ value: "3,300 NC", percent: "66%" });
    expect(allocation.overCommitted).toBe(false);
  });

  it("sizes bar segments as fractions of one scale that never exceeds 1", () => {
    const { allocation } = buildStrip({ projection: projection(), areas, alertsCount: 0 });
    const total = allocation.segments.reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeCloseTo(0.86, 5);
    expect(allocation.segments.every((s) => s.fraction >= 0 && s.fraction <= 1)).toBe(true);
  });

  it("rescales to the commitments and flags over-commitment when they exceed the appropriation", () => {
    const base = projection();
    const { allocation } = buildStrip({
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
    const { allocation } = buildStrip({
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
    const strip = buildStrip({ projection: projection(), areas, alertsCount: 0 });
    expect(strip.nationName).toBe("Britain");
  });

  const withEconomy = (patch: Partial<PlayerProjection["economy"]>) => {
    const base = projection();
    return buildStrip({
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
    // Committed 3,300 NC fits in 3,500 NC even though committed + construction (4,300 NC) does not.
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
    expect(a.committed.value).toBe("2,500 NC");
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
    expect(seg?.value).toBe("-200 NC");
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

describe("buildStatusStrip hover detail", () => {
  it("walks the appropriation down through each committed line to the balance", () => {
    const { outlook } = buildStrip({ projection: projection(), areas, alertsCount: 0 });
    expect(outlook.appropriation).toBe("5,000 NC");
    expect(outlook.steps.map((s) => [s.id, s.value, s.remainder])).toEqual([
      ["obligations", "-500 NC", "4,500 NC"],
      ["maintenance", "-2,000 NC", "2,500 NC"],
      ["research", "-800 NC", "1,700 NC"],
    ]);
    expect(outlook.balance.value).toBe("1,200 NC");
    // 1,200 NC less the 1,000 NC construction bound.
    expect(outlook.afterConstruction).toEqual({ value: "200 NC", tone: "normal" });
    expect(outlook.monthEndTreasury).toBe("51,200 NC");
    expect(outlook.runway).toBeNull();
    expect(outlook.shortfall).toBeNull();
  });

  it("flags a worst case that tips into deficit once construction is spent", () => {
    const base = projection();
    const { outlook } = buildStrip({
      projection: projection({ projectedSurplusDeficit: 300, economy: { ...base.economy } }),
      areas,
      alertsCount: 0,
    });
    expect(outlook.afterConstruction).toEqual({ value: "-700 NC", tone: "alert" });
  });

  it("adds each line's yearly figure and its share of the committed total", () => {
    const { allocation } = buildStrip({ projection: projection(), areas, alertsCount: 0 });
    const maintenance = allocation.segments.find((s) => s.id === "maintenance");
    expect(maintenance?.yearly).toBe("24,000 NC");
    expect(maintenance?.shareOfCommitted).toBe("61%");
    expect(allocation.segments.find((s) => s.id === "construction")?.shareOfCommitted).toBe("—");
  });

  it("names the areas, controllers and ships behind the foreign-station count", () => {
    const { stations } = buildStrip({
      projection: projection(),
      areas: [
        { id: "a_home", name: "Home waters", controller: "gbr" },
        { id: "a_foreign", name: "Biscay", controller: "fra" },
        { id: "a_sea", name: "Open sea", controller: null },
      ],
      alertsCount: 0,
    });
    expect(stations).toMatchObject({ total: 4, foreign: 1, unknown: false });
    expect(stations.foreignGroups).toEqual([
      {
        areaId: "a_foreign",
        areaName: "Biscay",
        controller: "fra",
        ships: [{ name: "C", tons: null }],
        tons: null,
      },
    ]);
  });

  it("reports the station split as unknown when the map could not be read", () => {
    const { stations } = buildStrip({
      projection: projection(),
      areas: null,
      alertsCount: 0,
    });
    expect(stations).toMatchObject({ total: 4, unknown: true, foreignGroups: [] });
  });

  it("lists ports largest first with a bar scaled to the largest", () => {
    const { ports } = buildStrip({
      projection: projection({
        ports: [
          { id: "p2", name: "Malta", areaId: "a_foreign", capacity: 2 },
          { id: "p1", name: "Portsmouth", areaId: "a_home", capacity: 4 },
        ],
      }),
      areas,
      alertsCount: 0,
    });
    expect(ports.map((p) => [p.name, p.areaName, p.fraction])).toEqual([
      ["Portsmouth", "Home waters", 1],
      ["Malta", "a_foreign", 0.5],
    ]);
  });
});

describe("buildStatusStrip foreign-station tonnage", () => {
  const withTons = (tons: Record<string, number | undefined>) => {
    const base = projection();
    return projection({
      fleet: base.fleet.map((f) => ({
        ...f,
        divisions: f.divisions.map((d) => ({
          ...d,
          ships: d.ships.map((ship) => {
            const t = tons[ship.name];
            return t === undefined ? ship : { ...ship, displacementTons: t };
          }),
        })),
      })),
    });
  };
  const namedAreas: StatusStripAreas = [
    { id: "a_home", name: "Home waters", controller: "gbr" },
    { id: "a_foreign", name: "Biscay", controller: "fra" },
    { id: "a_sea", name: "Open sea", controller: null },
  ];

  it("sums the foreign ships' design displacement and shows it beside the count", () => {
    const strip = buildStrip({
      projection: withTons({ A: 5_000, B: 6_000, C: 11_880, D: 2_000 }),
      areas: namedAreas,
      alertsCount: 0,
    });
    expect(strip.nation.find((r) => r.id === "foreign-stations")?.value).toBe("1 ship · 11,880 t");
    expect(strip.stations).toMatchObject({
      foreign: 1,
      foreignTons: "11,880 t",
      totalTons: "24,880 t",
    });
    expect(strip.stations.foreignTonsFraction).toBeCloseTo(11_880 / 24_880, 10);
    expect(strip.stations.foreignGroups[0]).toMatchObject({
      tons: "11,880 t",
      ships: [{ name: "C", tons: 11_880 }],
    });
  });

  it("omits the tonnage rather than sum a partial fleet when one ship has none", () => {
    // The foreign ship is known but a home ship is not: the foreign sum is exact, the total is not.
    const strip = buildStrip({
      projection: withTons({ C: 11_880 }),
      areas: namedAreas,
      alertsCount: 0,
    });
    expect(strip.stations.foreignTons).toBe("11,880 t");
    expect(strip.stations.totalTons).toBeNull();
    expect(strip.stations.foreignTonsFraction).toBeNull();
  });

  it("shows only the count when a foreign ship has no known displacement", () => {
    const strip = buildStrip({
      projection: withTons({ A: 5_000 }),
      areas: namedAreas,
      alertsCount: 0,
    });
    expect(strip.nation.find((r) => r.id === "foreign-stations")?.value).toBe("1 ship");
    expect(strip.stations.foreignTons).toBeNull();
    expect(strip.stations.foreignGroups[0]?.tons).toBeNull();
  });

  it("treats a ship with zero displacement as known, not missing", () => {
    const strip = buildStrip({
      projection: withTons({ A: 1, B: 1, C: 0, D: 1 }),
      areas: namedAreas,
      alertsCount: 0,
    });
    expect(strip.stations.foreignTons).toBe("0 t");
  });
});
