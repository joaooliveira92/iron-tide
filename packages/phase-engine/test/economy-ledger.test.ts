import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { applySetBudgetAllocation } from "../src/commands.js";
import { TEST_RESEARCH_CATALOGUE } from "./research-catalogue.helper.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

// Economy spec #138 slice 5: every outflow is recorded as requested, paid and shortfall, the ledger identity closes on
// paid, and a shortfall is a legal recorded state, not an error.
function nation(
  over: Partial<NationState> & { ships?: number; researchBudget?: SafeInt },
): NationState {
  const { ships: shipCount, researchBudget: _budget, ...rest } = over;
  const ships = shipCount ?? 0;
  return {
    prestige: SafeInt(20),
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

function snapshot(
  n: NationState,
  technologies?: CampaignSnapshot["world"]["technologies"],
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "economy-ledger",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "n", type: "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      ...(technologies === undefined ? {} : { technologies }),
    },
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

function run(n: NationState, technologies?: CampaignSnapshot["world"]["technologies"]) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot(n, technologies),
    [],
    "econ-ledger",
    collector,
  );
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

  it("reports, without charging, a standing research budget that finds no eligible field", () => {
    const { result, collector } = run(nation({ researchBudget: SafeInt(5) }));
    expect(collector.hasErrors).toBe(false);
    const info = collector.all.filter((d) => d.severity === "info").map((d) => d.code);
    expect(info).toContain("NO_ELIGIBLE_RESEARCH_FIELD");
    const research = result.financialLedger.all.filter(
      (e) => e.categoryId === "RESEARCH_EXPENDITURE",
    );
    expect(research.every((e) => (e.debit as number) === 0)).toBe(true);
  });

  it("ledgers a research request the treasury cannot pay at all, so the warning has a matching line", () => {
    const { result, collector } = run(
      nation({
        treasury: SafeInt(0),
        baseResources: SafeInt(0),
        expenses: SafeInt(0),
        researchBudget: SafeInt(4),
      }),
      TEST_RESEARCH_CATALOGUE,
    );
    const research = result.financialLedger.all.filter(
      (e) => e.categoryId === "RESEARCH_EXPENDITURE",
    );
    expect(research).toHaveLength(1);
    expect(research[0]).toMatchObject({ requested: 4, debit: 0, shortfall: 4 });
    expect(collector.warnings.filter((d) => d.code === "OUTFLOW_SHORTFALL")).toHaveLength(1);
  });

  it("reports no shortfall for a research budget that no field can take, whatever the treasury holds", () => {
    const { result, collector } = run(
      nation({
        treasury: SafeInt(1),
        baseResources: SafeInt(0),
        expenses: SafeInt(0),
        researchBudget: SafeInt(5),
      }),
    );
    expect(collector.warnings.map((d) => d.code)).not.toContain("OUTFLOW_SHORTFALL");
    expect(collector.all.map((d) => d.code)).toContain("NO_ELIGIBLE_RESEARCH_FIELD");
    expect(result.finalSnapshot.nations.get("n")!.treasury).toBe(1);
  });

  it("pays research from the pack catalogue and warns about progress beyond a technology's cost", () => {
    // basic_steam costs 100 and has 98 invested: of 5 points paid, 2 finish it and 3 cannot be applied.
    const { result, collector } = run(
      nation({
        researchBudget: SafeInt(5),
        research: {
          nationId: "n",
          technologies: [{ techId: "basic_steam", investedPoints: SafeInt(98), completed: false }],
          fieldPriorities: {
            MACHINERY: SafeInt(1),
            HULL_CONSTRUCTION: SafeInt(0),
            GUNNERY: SafeInt(0),
          },
          researchBudget: SafeInt(5),
          standingResearchBudget: SafeInt(5),
          activeCandidates: new Map(),
          discoveredTechs: [],
        },
      }),
      TEST_RESEARCH_CATALOGUE,
    );
    const spent = result.financialLedger.all.find((e) => e.categoryId === "RESEARCH_EXPENDITURE")!;
    expect(spent).toMatchObject({ requested: 5, debit: 5, shortfall: 0 });
    const unspent = collector.warnings.find((d) => d.code === "RESEARCH_UNSPENT");
    expect(unspent?.message).toContain("3");
    expect(unspent).toMatchObject({
      severity: "warning",
      stage: "resolve_research",
      entityId: "n",
    });
    expect(unspent?.message).toBe("Nation n paid 3 research points beyond the cost of basic_steam"); // stable wording: the same run reports the same text
    expect(result.finalSnapshot.nations.get("n")!.research.discoveredTechs).toContain(
      "basic_steam",
    );
  });

  it("never funds a cancelled project", () => {
    const { result, collector } = run(
      nation({
        constructionProjects: [
          {
            id: "proj-cancelled",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "ship-x",
            designVersionId: "",
            totalWork: SafeInt(500),
            completedWork: SafeInt(0),
            paidWork: SafeInt(0),
            status: "CANCELLED",
            startedAt: "1880-01",
          },
        ],
      }),
    );
    expect(collector.hasErrors).toBe(false);
    const project = result.finalSnapshot.nations.get("n")!.constructionProjects[0]!;
    expect(project.status).toBe("CANCELLED");
    expect(project.paidWork).toBe(0);
  });
});

describe("research cap on apply (defence in depth)", () => {
  // The lifecycle refuses an over-cap budget at validation; the apply step enforces the same rule, so a command that reaches it
  // by any other path cannot bypass the cap.
  const body = (rate: number, research: number) => ({
    type: "SetBudgetAllocation" as const,
    nationId: "n",
    appropriationRateBp: SafeInt(rate),
    researchBudget: SafeInt(research),
  });

  it("applies a budget at the cap and refuses one above it, leaving the snapshot untouched", () => {
    const snap = snapshot(nation({})); // base 6000: revenue 150 at 3000 bp => cap 18
    const ok = new DiagnosticCollector();
    const applied = applySetBudgetAllocation(snap, body(3000, 18), ok);
    expect(ok.hasErrors).toBe(false);
    expect(applied.nations.get("n")!.research.standingResearchBudget).toBe(18);

    const refused = new DiagnosticCollector();
    const same = applySetBudgetAllocation(snap, body(3000, 19), refused);
    expect(refused.errors.map((d) => d.code)).toEqual(["RESEARCH_ABOVE_CAP"]);
    expect(same).toBe(snap);
  });
});
