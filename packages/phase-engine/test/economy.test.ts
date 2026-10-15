import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeNation(
  id: string,
  overrides: Partial<{
    treasury: SafeInt;
    income: SafeInt;
    expenses: SafeInt;
    baseResources: SafeInt;
    projects: ConstructionProject[];
    ships: number;
  }>,
): NationState {
  const ships = overrides.ships ?? 0;
  return {
    id,
    name: id,
    tag: id,
    treasury: overrides.treasury ?? SafeInt(1000),
    income: overrides.income ?? SafeInt(100),
    expenses: overrides.expenses ?? SafeInt(50),
    baseResources: overrides.baseResources ?? SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: `${id} Fleet`,
        locationAreaId: "a-1",
        ships: Array.from({ length: ships }, (_, i) => ({
          id: `${id}-ship-${i}`,
          name: `${id} Ship ${i}`,
          classId: "battleship",
          nationId: id,
          locationAreaId: "a-1",
          designVersionId: "",
          hitPoints: SafeInt(100),
          maxHitPoints: SafeInt(100),
          speed: SafeInt(10),
          firepower: SafeInt(10),
          armor: SafeInt(10),
          isUnderConstruction: false,
          constructionProgress: SafeInt(100),
          constructionTotalWork: SafeInt(100),
        })),
      },
    ],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: overrides.projects ?? [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function makeSnapshot(nations: Array<[string, NationState]>): CampaignSnapshot {
  const map = new Map(nations);
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "economy-acceptance",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map(([nationId]) => ({
      nationId,
      type: nationId === "GBR" ? ("playable" as const) : ("ai" as const),
    })),
    world: { areas: [], routes: [], ports: [] },
    nations: map,
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

describe("B10a economy & construction acceptance (criteria 1-7)", () => {
  it("C1: runs a full monthly turn with GBR, FRA, and GER economy", () => {
    const gbr = makeNation("GBR", { treasury: SafeInt(1000), baseResources: SafeInt(120000) });
    const fra = makeNation("FRA", { treasury: SafeInt(800), baseResources: SafeInt(90000) });
    const ger = makeNation("GER", { treasury: SafeInt(600), baseResources: SafeInt(60000) });
    const snapshot = makeSnapshot([
      ["GBR", gbr],
      ["FRA", fra],
      ["GER", ger],
    ]);

    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "econ-seed", collector);

    expect(result.success).toBe(true);
    expect(collector.hasErrors).toBe(false);

    // All three nations recorded revenue (NAVAL_APPROPRIATION) postings.
    for (const nationId of ["GBR", "FRA", "GER"]) {
      const revenueEntries = result.financialLedger.all.filter(
        (e) => e.nationId === nationId && e.categoryId === "NAVAL_APPROPRIATION",
      );
      expect(revenueEntries.length).toBeGreaterThan(0);
      const final = result.finalSnapshot.nations.get(nationId)!;
      expect(final.treasury as number).toBeGreaterThan(0);
    }
  });

  it("C2: treasury updates via balanced ledger postings (revenue, maintenance, construction)", () => {
    const gbr = makeNation("GBR", {
      treasury: SafeInt(10000),
      baseResources: SafeInt(120000),
      ships: 1, // maintenance = floor(100*10/100) = 10
      projects: [
        {
          id: "proj-1",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "ship-x",
          designVersionId: "",
          totalWork: SafeInt(500),
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
          status: "PLANNED",
          startedAt: "1880-01",
        },
      ],
    });
    const snapshot = makeSnapshot([["GBR", gbr]]);

    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "econ-seed2", collector);

    expect(result.success).toBe(true);
    const gbrEntries = result.financialLedger.all.filter((e) => e.nationId === "GBR");
    // Revenue, appropriation, maintenance postings present and balanced.
    expect(gbrEntries.length).toBeGreaterThanOrEqual(2);
    for (const entry of gbrEntries) {
      expect(entry.debit as number).toBe(entry.credit as number);
    }
    expect(gbrEntries.some((e) => e.categoryId === "NAVAL_APPROPRIATION")).toBe(true);
    expect(gbrEntries.some((e) => e.categoryId === "MAINTENANCE_EXPENDITURE")).toBe(true);
  });

  it("C3: financial ledger hash is deterministic and equals canonical serialization", () => {
    const gbr = makeNation("GBR", {
      treasury: SafeInt(10000),
      baseResources: SafeInt(120000),
      projects: [
        {
          id: "proj-1",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "ship-x",
          designVersionId: "",
          totalWork: SafeInt(200),
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
          status: "PLANNED",
          startedAt: "1880-01",
        },
      ],
    });
    const snapshot = makeSnapshot([["GBR", gbr]]);
    const run = () => {
      const executor = new MonthExecutor();
      return executor.execute(snapshot, [], "ledger-seed", new DiagnosticCollector());
    };

    const r1 = run();
    const r2 = run();
    expect(r1.financialLedger.hash()).toBe(r2.financialLedger.hash());
    expect(r1.financialLedger.hash()).toBe(sha256Hex(canonicalSerialize(r1.financialLedger.all)));
  });

  it("C4: construction progresses only when funded; zero payment => zero progress", () => {
    const noFunds = makeNation("GBR", {
      treasury: SafeInt(10000),
      baseResources: SafeInt(0), // no revenue -> no appropriation
      projects: [
        {
          id: "proj-nf",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "ship-x",
          designVersionId: "",
          totalWork: SafeInt(200),
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
          status: "PLANNED",
          startedAt: "1880-01",
        },
      ],
    });
    const snapNF = makeSnapshot([["GBR", noFunds]]);
    const rNF = new MonthExecutor().execute(snapNF, [], "seed", new DiagnosticCollector());
    const projNF = rNF.finalSnapshot.nations.get("GBR")!.constructionProjects[0]!;
    expect(projNF.completedWork as number).toBe(0);
    expect(projNF.paidWork as number).toBe(0);
  });

  it("C5: a completed construction project produces a commissioned ship in FleetState", () => {
    const gbr = makeNation("GBR", {
      treasury: SafeInt(10000),
      baseResources: SafeInt(0),
      projects: [
        {
          id: "proj-done",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "new-ship",
          designVersionId: "",
          totalWork: SafeInt(100),
          completedWork: SafeInt(100),
          paidWork: SafeInt(100),
          status: "ACTIVE",
          startedAt: "1880-01",
        },
      ],
    });
    const snapshot = makeSnapshot([["GBR", gbr]]);
    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const final = result.finalSnapshot.nations.get("GBR")!;
    const completed = final.constructionProjects.find((p) => p.id === "proj-done")!;
    expect(completed.status).toBe("COMPLETED");
    const fleet = final.fleets.find((f) => f.ships.some((s) => s.id.includes("new-ship")));
    expect(fleet).toBeDefined();
    const ship = fleet!.ships.find((s) => s.id.includes("new-ship"))!;
    expect(ship.isUnderConstruction).toBe(false);
  });

  it("C6: treasury never goes negative at a committed boundary", () => {
    const gbr = makeNation("GBR", {
      treasury: SafeInt(20),
      baseResources: SafeInt(0),
      expenses: SafeInt(50),
    });
    const snapshot = makeSnapshot([["GBR", gbr]]);
    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const final = result.finalSnapshot.nations.get("GBR")!;
    expect(final.treasury as number).toBeGreaterThanOrEqual(0);
  });

  it("C7: all state changes are deterministic for a fixed seed", () => {
    const gbr = makeNation("GBR", {
      treasury: SafeInt(10000),
      baseResources: SafeInt(120000),
      projects: [
        {
          id: "proj-1",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "ship-x",
          designVersionId: "",
          totalWork: SafeInt(500),
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
          status: "PLANNED",
          startedAt: "1880-01",
        },
      ],
    });
    const snapshot = makeSnapshot([["GBR", gbr]]);
    const run = () =>
      new MonthExecutor().execute(snapshot, [], "det-seed", new DiagnosticCollector());
    const r1 = run();
    const r2 = run();
    expect(sha256Hex(canonicalSerialize(r1.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(r2.finalSnapshot)),
    );
    expect(r1.financialLedger.hash()).toBe(r2.financialLedger.hash());
  });
});
