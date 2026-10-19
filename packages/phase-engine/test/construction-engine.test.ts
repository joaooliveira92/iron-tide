import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  LINE_IDS,
  simulateConstruction,
  type ConstructionPlan,
  type LineId,
  type WorkPackage,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { EventLedger } from "@bluewave/events";
import { applyBudgetProject } from "../src/commands.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { MonthExecutor } from "../src/index.js";

const pk = (
  id: string,
  kind: WorkPackage["kind"],
  line: LineId,
  totalWork: number,
  dependsOn: string[] = [],
): WorkPackage => ({ id, kind, line, totalWork, dependsOn });
const plan: ConstructionPlan = (() => {
  const packages = [
    pk("hull", "HULL", "slipway", 100),
    pk("machinery", "MACHINERY", "machinery", 40),
    pk("armour", "ARMOUR", "armour_plate", 60),
    pk("ordnance", "ORDNANCE", "heavy_gun", 30),
    pk("launch", "LAUNCH", "slipway", 20, ["hull"]),
    pk("fit_out", "FIT_OUT", "quay", 50, ["launch", "machinery", "armour", "ordnance"]),
    pk("trials", "TRIALS", "trials", 10, ["fit_out"]),
    pk("acceptance", "ACCEPTANCE", "trials", 5, ["trials"]),
  ];
  return { packages, totalWork: packages.reduce((a, p) => a + p.totalWork, 0) };
})();
const TOTAL = plan.totalWork;

const design = (capacityPerLine: number): CompiledDesignVersion =>
  ({
    designVersionId: "d1",
    designFamilyId: "fam",
    className: "Test",
    nationId: "GBR",
    hullType: "DD",
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(10_000_000),
    normalizedArmorUm: SafeInt(0),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(0),
    mainGunsCount: SafeInt(0),
    machineryType: "steam",
    crewComplement: SafeInt(10),
    contentVersion: "t",
    compiledHash: "h",
    constructionCostUnits: SafeInt(TOTAL),
    constructionPlan: {
      yardId: "yard_small",
      packages: plan.packages.map((p) => ({
        id: p.id,
        kind: p.kind,
        line: p.line,
        totalWork: SafeInt(p.totalWork),
        dependsOn: [...p.dependsOn],
      })),
      capacityUnits: Object.fromEntries(
        LINE_IDS.map((l) => [l, SafeInt(capacityPerLine)]),
      ) as Record<string, SafeInt>,
    },
  }) as CompiledDesignVersion;

const project = (withPackages: boolean): ConstructionProject => ({
  id: "proj-1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "ship-x",
  designVersionId: "d1",
  totalWork: SafeInt(TOTAL),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "PLANNED",
  startedAt: "1880-01",
  ...(withPackages
    ? {
        packages: plan.packages.map((p) => ({
          id: p.id,
          kind: p.kind,
          line: p.line as string,
          totalWork: SafeInt(p.totalWork),
          doneWork: SafeInt(0),
          dependsOn: [...p.dependsOn],
        })),
        yardId: "yard_small",
      }
    : {}),
});

const nation = (projects: ConstructionProject[]): NationState => ({
  prestige: SafeInt(20),
  id: "GBR",
  name: "GBR",
  tag: "GBR",
  treasury: SafeInt(1_000_000),
  income: SafeInt(100),
  expenses: SafeInt(0),
  baseResources: SafeInt(100_000_000),
  navalAppropriationRateBp: SafeInt(2000),
  maintenanceCost: SafeInt(0),
  fleets: [],
  divisions: [],
  research: {
    nationId: "GBR",
    technologies: [],
    fieldPriorities: {},
    researchBudget: SafeInt(0),
    activeCandidates: new Map(),
    discoveredTechs: [],
  },
  constructionProjects: projects,
  isPlayable: true,
  isAI: false,
});

const snapshotOf = (projects: ConstructionProject[], capacityPerLine: number): CampaignSnapshot =>
  ({
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "pkg-engine",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" as const }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation(projects)]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([["d1", design(capacityPerLine)]]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  }) as unknown as CampaignSnapshot;

/** Runs months through the real executor until the project completes (or `max` months). */
function runUntilComplete(snapshot: CampaignSnapshot, max = 60) {
  let current = snapshot;
  const history: ConstructionProject[] = [];
  const treasury: number[] = [current.nations.get("GBR")!.treasury as number];
  for (let m = 0; m < max; m++) {
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(current, [], `seed-${m}`, collector);
    expect(result.success).toBe(true);
    // The caller (the campaign layer) advances the calendar between months; the executor does not.
    current = {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
    };
    const p = current.nations.get("GBR")!.constructionProjects[0]!;
    history.push(p);
    treasury.push(current.nations.get("GBR")!.treasury as number);
    if (p.status === "COMPLETED") break;
  }
  return { history, treasury, final: current };
}

describe("per-package construction through the month executor (ADR-0077)", () => {
  it("completes in exactly the forecast's number of months for several yard capacities", () => {
    for (const cap of [20, 45, 1_000]) {
      const sim = simulateConstruction(
        plan,
        {
          capacity: Object.fromEntries(LINE_IDS.map((l) => [l, cap])) as Record<LineId, number>,
          monthlyFundingMicro: null,
          costPerWorkMicro: 1,
        },
        500,
      );
      const { history } = runUntilComplete(snapshotOf([project(true)], cap));
      const finished = history.findIndex((p) => p.status === "COMPLETED");
      expect(finished + 1, `capacity ${cap}`).toBe(sim.durationMonths);
    }
  });

  it("keeps the package invariants every month and charges only the work applied", () => {
    const { history, treasury } = runUntilComplete(snapshotOf([project(true)], 30));
    let paidBefore = 0;
    for (const [i, p] of history.entries()) {
      expect(p.packages!.reduce((a, x) => a + (x.doneWork as number), 0)).toBe(p.completedWork);
      for (const x of p.packages!)
        expect(x.doneWork as number).toBeLessThanOrEqual(x.totalWork as number);
      const paid = p.paidWork as number;
      expect(paid).toBeGreaterThanOrEqual(paidBefore);
      paidBefore = paid;
      // Treasury fell by no more than the work paid for (revenue may add to it).
      expect(treasury[i]! - treasury[i + 1]!).toBeLessThanOrEqual(
        paid - (i === 0 ? 0 : (history[i - 1]!.paidWork as number)),
      );
    }
    const last = history.at(-1)!;
    expect(last.completedWork).toBe(TOTAL);
    expect(last.paidWork).toBe(TOTAL);
  });

  it("a legacy project (no packages) is unaffected: the same funds finish it in far fewer months", () => {
    const legacy = runUntilComplete(snapshotOf([project(false)], 20));
    const packaged = runUntilComplete(snapshotOf([project(true)], 20));
    expect(legacy.history.length).toBeLessThan(packaged.history.length);
    expect(legacy.history.at(-1)!.packages).toBeUndefined();
  });

  it("is deterministic", () => {
    const a = runUntilComplete(snapshotOf([project(true)], 30));
    const b = runUntilComplete(snapshotOf([project(true)], 30));
    expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
  });

  it("launches a completed hull into working up with no worked-up crew (S-1 D2)", () => {
    const { final } = runUntilComplete(snapshotOf([project(true)], 30));
    const ship = final.nations.get("GBR")!.fleets[0]!.ships[0]!;
    expect(ship.isUnderConstruction).toBe(false);
    expect(ship.readiness).toBe("WORKING_UP");
    expect(ship.crewQuality).toBe(0);
  });
});

describe("budget_project on a project with work packages (ADR-0077)", () => {
  const budget = (snapshot: CampaignSnapshot, amount: number, month: string) => {
    const collector = new DiagnosticCollector();
    let n = 0;
    const next = applyBudgetProject(
      snapshot,
      {
        type: "budget_project",
        nationId: "GBR",
        projectId: "proj-1",
        budget: SafeInt(amount),
      },
      month,
      SafeInt(0),
      () => SafeInt(n++),
      new FinancialLedger(),
      new EventLedger(),
      collector,
    );
    return { next, codes: collector.all.map((x) => x.code) };
  };
  const gbr = (s: CampaignSnapshot) => s.nations.get("GBR")!;

  it("applies and charges only what the yard can do, not the whole budget", () => {
    const snap = snapshotOf([project(true)], 20);
    const { next } = budget(snap, 10_000, "1880-02");
    const p = gbr(next).constructionProjects[0]!;
    expect(p.completedWork).toBe(80); // 20 units on each of the four first lines
    expect(p.paidWork).toBe(80);
    expect(gbr(snap).treasury - gbr(next).treasury).toBe(80);
  });

  it("a second budget in the same month finds the capacity used up: a warning, no change, nothing charged", () => {
    const first = budget(snapshotOf([project(true)], 20), 10_000, "1880-02").next;
    const second = budget(first, 10_000, "1880-02");
    expect(second.codes).toContain("PROJECT_CAPACITY_EXHAUSTED");
    expect(second.next).toBe(first);
    // The next month there is capacity again.
    const later = budget(first, 10_000, "1880-03").next;
    expect(gbr(later).constructionProjects[0]!.completedWork as number).toBeGreaterThan(80);
  });

  it("a small budget is applied in full, in package order", () => {
    const { next } = budget(snapshotOf([project(true)], 1_000), 30, "1880-02");
    const p = gbr(next).constructionProjects[0]!;
    expect(p.completedWork).toBe(30);
    expect(p.packages!.find((x) => x.id === "hull")!.doneWork).toBe(30);
  });

  it("leaves legacy projects exactly as before: the whole budget is applied and charged", () => {
    const snap = snapshotOf([project(false)], 20);
    const { next } = budget(snap, 50, "1880-02");
    expect(gbr(next).constructionProjects[0]!.completedWork).toBe(50);
    expect(gbr(snap).treasury - gbr(next).treasury).toBe(50);
  });
});
