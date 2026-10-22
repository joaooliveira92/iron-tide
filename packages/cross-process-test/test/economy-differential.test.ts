import { buildOpeningBriefingProjection, buildPlayerProjection } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";
import { compileProductionCampaign } from "./economy-scenarios.helper.js";

const { state } = compileProductionCampaign();
const result = new MonthExecutor().execute(
  state.snapshot,
  [],
  "economy-differential",
  new DiagnosticCollector(),
);
const month = { month: 1, year: 1880 };

function ledgerSum(
  nationId: string,
  category: string,
  field: "requested" | "debit" | "credit",
): number {
  return result.financialLedger.all
    .filter((e) => e.nationId === nationId && e.categoryId === category)
    .reduce((sum, e) => sum + Number(e[field] ?? e.debit), 0);
}

describe("projection vs the first executed month", () => {
  for (const nationId of state.snapshot.nations.keys()) {
    it(`${nationId}: revenue, obligations, maintenance and research match the ledger`, () => {
      const economy = buildPlayerProjection(state, nationId, month)!.economy;
      expect(economy.monthlyAppropriation).toBe(
        ledgerSum(nationId, "NAVAL_APPROPRIATION", "credit"),
      );
      expect(economy.obligations).toBe(ledgerSum(nationId, "OBLIGATION", "requested"));
      expect(economy.maintenanceCost).toBe(
        ledgerSum(nationId, "MAINTENANCE_EXPENDITURE", "requested"),
      );
      expect(economy.researchSpend).toBe(ledgerSum(nationId, "RESEARCH_EXPENDITURE", "requested"));
    });

    it(`${nationId}: planned construction is an upper bound on the executed draw`, () => {
      const economy = buildPlayerProjection(state, nationId, month)!.economy;
      expect(economy.plannedConstruction).toBeGreaterThanOrEqual(
        ledgerSum(nationId, "APPROPRIATION", "debit"),
      );
    });

    it(`${nationId}: month-end treasury at the upper bound is no more than the executed one`, () => {
      const economy = buildPlayerProjection(state, nationId, month)!.economy;
      const executed = Number(result.finalSnapshot.nations.get(nationId)!.treasury);
      expect(economy.monthEndTreasury).toBeLessThanOrEqual(executed);
    });

    it(`${nationId}: the opening briefing and the projection show one status and one net`, () => {
      const projection = buildPlayerProjection(state, nationId, month)!;
      const briefing = buildOpeningBriefingProjection(state, nationId, month)!;
      expect(briefing.treasury.status).toBe(projection.economy.status);
      expect(briefing.treasury.projectedSurplus).toBe(projection.projectedSurplusDeficit);
      expect(briefing.treasury.governmentAllocation).toBe(projection.economy.monthlyAppropriation);
    });
  }

  it("reports a runway for Portugal and none for a nation with a positive net", () => {
    expect(buildPlayerProjection(state, "portugal", month)!.economy.runwayMonths).toBe(40);
    expect(buildPlayerProjection(state, "uk", month)!.economy.runwayMonths).toBeUndefined();
  });

  it("explains why a small nation's standing research is unfunded or zero", () => {
    const japan = buildPlayerProjection(state, "japan", month)!.economy;
    expect(japan.researchRequested).toBe(0);
    expect(japan.researchCap).toBeGreaterThanOrEqual(0);
  });
});
