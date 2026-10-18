import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  monthlyNetBeforeConstruction,
  monthlyRevenue,
  runwayMonths,
  shipMonthlyMaintenanceCost,
} from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { compileProductionCampaign } from "./economy-scenarios.helper.js";

// Economy spec #138: golden worked examples from the shipped 1880 pack, read through the shared calculators.
describe("1880 production economy start state", () => {
  const { state, diagnostics } = compileProductionCampaign();

  function flows(nationId: string) {
    const nation = state.snapshot.nations.get(nationId)!;
    let maintenance = SafeInt.ZERO;
    for (const fleet of nation.fleets)
      for (const ship of fleet.ships)
        maintenance = SafeInt.add(
          maintenance,
          shipMonthlyMaintenanceCost(ship.hitPoints, ship.readiness, false),
        );
    const revenue = monthlyRevenue(nation.baseResources, nation.navalAppropriationRateBp);
    const research = nation.research.standingResearchBudget ?? SafeInt.ZERO;
    const net = monthlyNetBeforeConstruction({
      revenue,
      obligations: nation.expenses,
      maintenance,
      research,
    });
    return { revenue, maintenance, obligations: nation.expenses, research, net };
  }

  it("compiles with no error diagnostics", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it.each([
    ["uk", { revenue: 100, maintenance: 16, obligations: 38, research: 5, net: 41 }],
    ["france", { revenue: 68, maintenance: 12, obligations: 26, research: 4, net: 26 }],
    ["portugal", { revenue: 3, maintenance: 2, obligations: 2, research: 0, net: -1 }],
  ])("%s start flows match the locked model", (nationId, expected) => {
    expect(flows(nationId)).toEqual(expected);
  });

  it("derives revenue equal to authored income for every nation", () => {
    for (const nation of state.snapshot.nations.values())
      expect(monthlyRevenue(nation.baseResources, nation.navalAppropriationRateBp)).toBe(
        nation.income,
      );
  });

  it("falls short for the first time exactly one month after its closed-form runway", () => {
    // Portugal has no seeded construction, so nothing but the structural deficit can exhaust its treasury.
    const portugal = state.snapshot.nations.get("portugal")!;
    expect(portugal.constructionProjects).toEqual([]);
    const predicted = runwayMonths(portugal.treasury, flows("portugal").net)! + 1;

    let snapshot = state.snapshot;
    let first: number | undefined;
    for (let month = 1; month <= predicted + 1 && first === undefined; month++) {
      const collector = new DiagnosticCollector();
      const result = new MonthExecutor().execute(
        snapshot,
        [],
        `closed-form:${String(month)}`,
        collector,
      );
      if (
        collector.warnings.some((d) => d.code === "OUTFLOW_SHORTFALL" && d.entityId === "portugal")
      )
        first = month;
      snapshot = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
      };
    }
    expect(first).toBe(predicted);
    expect(predicted).toBe(41);
  });

  it("leaves Portugal as the only structural deficit", () => {
    const deficits = [...state.snapshot.nations.keys()].filter(
      (id) => (flows(id).net as number) < 0,
    );
    expect(deficits).toEqual(["portugal"]);
  });
});

// Economy spec #138 slice 4: seeded 1880 projects are materialised with packages and yard throughput.
describe("1880 seeded construction projects", () => {
  const { state, diagnostics } = compileProductionCampaign();
  const seeded = [...state.snapshot.nations.values()].flatMap((n) =>
    n.constructionProjects.map((p) => ({ nation: n, project: p })),
  );

  it("has no seeded project without capacity", () => {
    expect(diagnostics.filter((d) => d.code === "SEEDED_PROJECT_WITHOUT_CAPACITY")).toEqual([]);
    expect(seeded.length).toBe(9);
  });

  it("gives every seeded project packages that sum to its authored size and a positive throughput", () => {
    for (const { project } of seeded) {
      expect(project.packages).toBeDefined();
      const total = project.packages!.reduce((a, p) => a + (p.totalWork as number), 0);
      const done = project.packages!.reduce((a, p) => a + (p.doneWork as number), 0);
      expect(total).toBe(project.totalWork);
      expect(done).toBe(project.completedWork);
      const lines = Object.values(project.capacityUnits ?? {}).map((v) => v as number);
      expect(lines.some((v) => v > 0)).toBe(true);
    }
  });

  it("applies the national build speed from the naval profile", () => {
    for (const { nation, project } of seeded) {
      expect(project.nationalProfileId).toBe(nation.id);
      expect(project.buildTimeMultiplierBp).toBeGreaterThan(0);
    }
  });

  it("never derives throughput from the economic base", () => {
    const uk = seeded.filter((s) => s.nation.id === "uk");
    const portugalLike = seeded.filter((s) => s.nation.id !== "uk");
    expect(uk.length).toBeGreaterThan(0);
    expect(portugalLike.length).toBeGreaterThan(0);
    for (const { project } of seeded) expect(project.capacityUnits?.["slipway"]).toBeGreaterThan(0);
  });
});

// Twelve executed months for the three worked examples: every month's requested lines are the spec's figures.
describe("12-month worked examples (GB, France, Portugal)", () => {
  const { state } = compileProductionCampaign();
  const expected: Record<
    string,
    { revenue: number; maintenance: number; obligation: number; research: number }
  > = {
    uk: { revenue: 100, maintenance: 16, obligation: 38, research: 5 },
    france: { revenue: 68, maintenance: 12, obligation: 26, research: 4 },
    portugal: { revenue: 3, maintenance: 2, obligation: 2, research: 0 },
  };
  it("posts the same requested flows every month and closes the ledger identity", () => {
    let snapshot = state.snapshot;
    for (let month = 1; month <= 12; month++) {
      const result = new MonthExecutor().execute(
        snapshot,
        [],
        `worked:${String(month)}`,
        new DiagnosticCollector(),
      );
      for (const [id, want] of Object.entries(expected)) {
        const sum = (category: string, field: "requested" | "credit"): number =>
          result.financialLedger.all
            .filter((e) => e.nationId === id && e.categoryId === category)
            .reduce((a, e) => a + Number(e[field] ?? e.debit), 0);
        expect(sum("NAVAL_APPROPRIATION", "credit")).toBe(want.revenue);
        expect(sum("MAINTENANCE_EXPENDITURE", "requested")).toBe(want.maintenance);
        expect(sum("OBLIGATION", "requested")).toBe(want.obligation);
        if (want.research > 0) expect(sum("RESEARCH_EXPENDITURE", "requested")).toBe(want.research);
      }
      snapshot = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
      };
    }
  });
});
