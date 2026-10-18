import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

// Economy spec #138 slice 5: every outflow is recorded as requested, paid and shortfall, the ledger identity closes on
// paid, and a shortfall is a legal recorded state, not an error.
function nation(
  over: Partial<NationState> & { ships?: number; researchBudget?: SafeInt },
): NationState {
  const { ships: shipCount, researchBudget: _budget, ...rest } = over;
  const ships = shipCount ?? 0;
  return {
    id: "n",
    name: "n",
    tag: "N",
    treasury: SafeInt(500),
    income: SafeInt(100),
    expenses: SafeInt(38),
    baseResources: SafeInt(6000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: "fleet-n",
        nationId: "n",
        name: "Fleet",
        locationAreaId: "a-1",
        ships: Array.from({ length: ships }, (_, i) => ({
          id: `n-ship-${i}`,
          name: `Ship ${i}`,
          classId: "battleship",
          nationId: "n",
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
          readiness: "ACTIVE" as const,
          crewQuality: SafeInt(100),
        })),
      },
    ],
    divisions: [],
    research: {
      nationId: "n",
      technologies: [],
      fieldPriorities: {},
      researchBudget: over.researchBudget ?? SafeInt(0),
      standingResearchBudget: over.researchBudget ?? SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...rest,
  };
}

function snapshot(n: NationState): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "economy-ledger",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "n", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["n", n]]),
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

function run(n: NationState) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(snapshot(n), [], "econ-ledger", collector);
  return { result, collector };
}

describe("economy ledger identity and shortfall", () => {
  it("closes: closing = opening + revenue - maintenance - obligation", () => {
    const { result, collector } = run(nation({ ships: 1 }));
    expect(collector.hasErrors).toBe(false);
    const entries = result.financialLedger.all;
    const revenue = entries.find((e) => e.categoryId === "NAVAL_APPROPRIATION")!;
    const maintenance = entries.find((e) => e.categoryId === "MAINTENANCE_EXPENDITURE")!;
    const obligation = entries.find((e) => e.categoryId === "OBLIGATION")!;
    expect(revenue.credit).toBe(100);
    expect(maintenance).toMatchObject({ requested: 10, debit: 10, shortfall: 0 });
    expect(obligation).toMatchObject({ requested: 38, debit: 38, shortfall: 0 });
    expect(result.finalSnapshot.nations.get("n")!.treasury).toBe(500 + 100 - 10 - 38);
  });

  it("records an obligation shortfall as a warning and clamps the treasury at zero", () => {
    const { result, collector } = run(
      nation({ treasury: SafeInt(2), baseResources: SafeInt(0), expenses: SafeInt(10) }),
    );
    expect(result.success).toBe(true);
    expect(collector.hasErrors).toBe(false);
    const obligation = result.financialLedger.all.find((e) => e.categoryId === "OBLIGATION")!;
    expect(obligation).toMatchObject({ requested: 10, debit: 2, credit: 2, shortfall: 8 });
    expect(obligation.newBalance).toBe(0);
    expect(collector.warnings.map((d) => d.code)).toContain("OUTFLOW_SHORTFALL");
    expect(result.finalSnapshot.nations.get("n")!.treasury).toBe(0);
  });

  it("records a maintenance shortfall with the paid amount, not the requested one", () => {
    const { result, collector } = run(
      nation({ treasury: SafeInt(4), baseResources: SafeInt(0), expenses: SafeInt(0), ships: 1 }),
    );
    const maintenance = result.financialLedger.all.find(
      (e) => e.categoryId === "MAINTENANCE_EXPENDITURE",
    )!;
    expect(maintenance).toMatchObject({ requested: 10, debit: 4, shortfall: 6 });
    expect(collector.warnings.map((d) => d.code)).toContain("OUTFLOW_SHORTFALL");
  });

  it("gives every outflow of one month the same relabel-invariant outcome", () => {
    const a = run(nation({ ships: 1 })).result.finalSnapshot.nations.get("n")!;
    const relabelled = { ...nation({ ships: 1 }), id: "zz", name: "zz", tag: "ZZ" };
    const snap = snapshot(relabelled);
    const r = new MonthExecutor().execute(
      {
        ...snap,
        slots: [{ nationId: "zz", type: "playable" }],
        nations: new Map([["zz", relabelled]]),
      },
      [],
      "econ-ledger",
      new DiagnosticCollector(),
    );
    expect(r.finalSnapshot.nations.get("zz")!.treasury).toBe(a.treasury);
  });

  it("warns when a standing research budget finds no eligible field and charges nothing", () => {
    const { result, collector } = run(nation({ researchBudget: SafeInt(5) }));
    expect(collector.hasErrors).toBe(false);
    expect(collector.warnings.map((d) => d.code)).toContain("RESEARCH_UNSPENT");
    const research = result.financialLedger.all.filter(
      (e) => e.categoryId === "RESEARCH_EXPENDITURE",
    );
    expect(research.every((e) => (e.debit as number) === 0)).toBe(true);
  });
});
