import type {
  CampaignSnapshot,
  ConstructionProject,
  NationDockState,
  NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import {
  DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS,
  DOCK_EXPANSION_PROJECT_TYPE,
  PRIVATE_DOCK_EXPANSION_COOLDOWN_MONTHS,
  PRIVATE_DOCK_EXPANSION_EVENT_ID,
  PRIVATE_DOCK_EXPANSION_MIN_UTILIZATION_BP,
  PRIVATE_DOCK_EXPANSION_STREAM_FAMILY,
  authorizeDockExpansion,
  dockExpansionCompletes,
  dockExpansionMonthIsActive,
  isDockExpansionProject,
  privateDockExpansionEligibility,
  resolvePrivateDockExpansion,
  trailingDockUtilizationBp,
} from "../src/dockExpansion.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const DOCK: NationDockState = {
  maximumNewConstructionMassKg: 10_000_000,
  maximumMajorRepairMassKg: 10_000_000,
  maximumRebuildMassKg: 10_000_000,
  maximumConversionMassKg: 10_000_000,
};

function addMonths(month: string, delta: number): string {
  const idx = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${String(Math.floor(idx / 12))}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function history(
  end: string,
  utilizationBp: number,
  count = 12,
): { month: string; utilizationBp: number }[] {
  return Array.from({ length: count }, (_v, i) => ({
    month: addMonths(end, -(count - 1 - i)),
    utilizationBp,
  }));
}

function nation(id: string, over: Partial<NationState> = {}): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id.toUpperCase(),
    treasury: SafeInt(1_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(0),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...over,
  };
}

function snapshot(nations: NationState[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "dock-expansion",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map((n) => ({ nationId: n.id, type: "playable" as const })),
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(nations.map((n) => [n.id, n])),
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
    compatibilityVersion: "1.2.0",
  };
}

function expansionProject(over: Partial<ConstructionProject> = {}): ConstructionProject {
  return {
    id: "dock-expansion-GBR-home-1880-01",
    type: "building",
    projectType: DOCK_EXPANSION_PROJECT_TYPE,
    targetId: "gbr-home",
    designVersionId: "",
    totalWork: SafeInt(DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    elapsedActiveMonths: 0,
    dockExpansionDurationMonths: 12,
    dockExpansionStepKg: 1_000_000,
    ...over,
  };
}

describe("dock expansion completion (SB3-R16)", () => {
  it("completes only when BOTH elapsed active months and paid work are sufficient", () => {
    expect(
      dockExpansionCompletes(expansionProject({ elapsedActiveMonths: 12, paidWork: SafeInt(0) })),
    ).toBe(false);
    expect(
      dockExpansionCompletes(
        expansionProject({
          elapsedActiveMonths: 11,
          paidWork: SafeInt(DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
        }),
      ),
    ).toBe(false);
    expect(
      dockExpansionCompletes(
        expansionProject({
          elapsedActiveMonths: 12,
          paidWork: SafeInt(DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
        }),
      ),
    ).toBe(true);
    expect(dockExpansionCompletes(expansionProject({ dockExpansionStepKg: undefined }))).toBe(
      false,
    );
  });

  it("counts only ACTIVE/ACCELERATED months; a halted or delayed month contributes zero", () => {
    expect(dockExpansionMonthIsActive("ACTIVE")).toBe(true);
    expect(dockExpansionMonthIsActive("ACCELERATED")).toBe(true);
    expect(dockExpansionMonthIsActive("HALTED")).toBe(false);
    expect(dockExpansionMonthIsActive("DELAYED")).toBe(false);
    expect(dockExpansionMonthIsActive("AWAITING_CAPACITY")).toBe(false);
    expect(dockExpansionMonthIsActive("PLANNED")).toBe(false);
  });

  it("raises every covered dock limit by the locked step when the month completes it", () => {
    const project = expansionProject({
      elapsedActiveMonths: 11,
      completedWork: SafeInt(DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
      paidWork: SafeInt(DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
      status: "ACTIVE",
    });
    const from = snapshot([nation("GBR", { dock: DOCK, constructionProjects: [project] })]);
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(from, [], "seed", collector);
    expect(collector.errors.map((e) => e.code)).toEqual([]);
    expect(result.success).toBe(true);
    const updated = result.finalSnapshot.nations.get("GBR")!;
    expect(updated.dock).toEqual({
      maximumNewConstructionMassKg: 11_000_000,
      maximumMajorRepairMassKg: 11_000_000,
      maximumRebuildMassKg: 11_000_000,
      maximumConversionMassKg: 11_000_000,
    });
    const completed = updated.constructionProjects.find((p) => p.id === project.id)!;
    expect(completed.status).toBe("COMPLETED");
    expect(completed.elapsedActiveMonths).toBe(12);
  });

  it("does not complete on elapsed time alone in a real month", () => {
    const project = expansionProject({
      elapsedActiveMonths: 11,
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE",
    });
    const from = snapshot([nation("GBR", { dock: DOCK, constructionProjects: [project] })]);
    const result = new MonthExecutor().execute(from, [], "seed", new DiagnosticCollector());
    const updated = result.finalSnapshot.nations.get("GBR")!;
    const after = updated.constructionProjects.find((p) => p.id === project.id)!;
    expect(after.status).not.toBe("COMPLETED");
    expect(updated.dock).toEqual(DOCK);
  });
});

describe("dock expansion authorization (SB3-R16)", () => {
  it("locks the era step at authorization; later calendar advancement does not change it", () => {
    const early = authorizeDockExpansion(snapshot([nation("GBR")]), {
      nationId: "GBR",
      possessionId: "gbr-home",
      campaignMonth: "1880-06",
    });
    expect(early.ok).toBe(true);
    if (!early.ok) return;
    expect(early.stepKg).toBe(1_000_000);
    expect(early.project.dockExpansionStepKg).toBe(1_000_000);
    expect(early.project.dockExpansionDurationMonths).toBe(12);
    expect(isDockExpansionProject(early.project)).toBe(true);

    const later = authorizeDockExpansion(snapshot([nation("GBR")]), {
      nationId: "GBR",
      possessionId: "gbr-home",
      campaignMonth: "1920-06",
    });
    expect(later.ok).toBe(true);
    if (!later.ok) return;
    expect(later.stepKg).toBe(1_500_000);
    expect(early.project.dockExpansionStepKg).toBe(1_000_000);
  });

  it("fails closed for a month outside every authored era", () => {
    const result = authorizeDockExpansion(snapshot([nation("GBR")]), {
      nationId: "GBR",
      possessionId: "gbr-home",
      campaignMonth: "1975-01",
    });
    expect(result.ok).toBe(false);
  });
});

describe("private dock-expansion opportunity (SB3-R17)", () => {
  const eligibleNation = (id: string, over: Partial<NationState> = {}): NationState =>
    nation(id, {
      dockExpansion: {
        possessions: [
          { possessionId: `${id}-home`, eligible: true, utilization: history("1880-06", 8_000) },
        ],
      },
      ...over,
    });

  it("measures the trailing-12-month utilisation and refuses to infer from missing history", () => {
    expect(trailingDockUtilizationBp(history("1880-06", 8_000), "1880-06")).toBe(8_000);
    expect(trailingDockUtilizationBp(history("1880-06", 6_000), "1880-06")).toBe(6_000);
    expect(trailingDockUtilizationBp(history("1880-06", 8_000, 11), "1880-06")).toBeNull();
    expect(
      trailingDockUtilizationBp(
        [...history("1880-06", 8_000), { month: "nonsense", utilizationBp: 10_000 }],
        "1880-06",
      ),
    ).toBe(8_000);
  });

  it("is eligible only with explicit eligibility and sufficient trailing utilisation", () => {
    expect(privateDockExpansionEligibility(eligibleNation("AAA"), "1880-06")).toMatchObject({
      eligible: true,
      possessionId: "AAA-home",
      reason: "ELIGIBLE",
      trailingUtilizationBp: 8_000,
    });
    const onThreshold = eligibleNation("AAA");
    onThreshold.dockExpansion!.possessions[0]!.utilization = history("1880-06", 7_500);
    expect(privateDockExpansionEligibility(onThreshold, "1880-06").eligible).toBe(true);
    const below = eligibleNation("AAA");
    below.dockExpansion!.possessions[0]!.utilization = history("1880-06", 7_499);
    expect(privateDockExpansionEligibility(below, "1880-06").reason).toBe("BELOW_UTILIZATION");
    const noEligibility = nation("AAA", {
      dockExpansion: {
        possessions: [
          { possessionId: "aaa-home", eligible: false, utilization: history("1880-06", 9_000) },
        ],
      },
    });
    expect(privateDockExpansionEligibility(noEligibility, "1880-06").reason).toBe(
      "NO_EXPLICIT_ELIGIBILITY",
    );
    expect(privateDockExpansionEligibility(nation("AAA"), "1880-06").reason).toBe("NO_STATE");
    const short = nation("AAA", {
      dockExpansion: {
        possessions: [
          { possessionId: "aaa-home", eligible: true, utilization: history("1880-06", 9_000, 5) },
        ],
      },
    });
    expect(privateDockExpansionEligibility(short, "1880-06").reason).toBe("INSUFFICIENT_HISTORY");
  });

  it("enforces the 60-month cooldown and the one-active-event rule", () => {
    const cooled = eligibleNation("AAA", {
      dockExpansion: {
        possessions: [
          { possessionId: "aaa-home", eligible: true, utilization: history("1880-06", 8_000) },
        ],
        lastOpportunityMonth: "1876-06",
      },
    });
    expect(privateDockExpansionEligibility(cooled, "1880-06").reason).toBe("COOLDOWN");
    const cooledOut = eligibleNation("AAA", {
      dockExpansion: {
        possessions: [
          { possessionId: "aaa-home", eligible: true, utilization: history("1880-06", 8_000) },
        ],
        lastOpportunityMonth: "1875-06",
      },
    });
    expect(privateDockExpansionEligibility(cooledOut, "1880-06").eligible).toBe(true);

    const active = eligibleNation("AAA", { constructionProjects: [expansionProject()] });
    expect(privateDockExpansionEligibility(active, "1880-06").reason).toBe("ACTIVE_EVENT");
  });

  it("processes the ascending-first eligible possession", () => {
    const multi = nation("AAA", {
      dockExpansion: {
        possessions: [
          { possessionId: "aaa-z", eligible: true, utilization: history("1880-06", 9_000) },
          { possessionId: "aaa-a", eligible: true, utilization: history("1880-06", 9_000) },
        ],
      },
    });
    expect(privateDockExpansionEligibility(multi, "1880-06").possessionId).toBe("aaa-a");
  });

  it("keys the decision stream and reproduces the same event for the same seed", () => {
    const from = snapshot([eligibleNation("AAA"), eligibleNation("BBB")]);
    const run = (seed: string) => {
      const ledger = new RandomLedger();
      const outcome = resolvePrivateDockExpansion({
        snapshot: from,
        campaignMonth: "1880-06",
        randomEngine: new RandomEngine(seed),
        randomLedger: ledger,
      });
      return { outcome, ledgerHash: ledger.hash(), decisions: ledger.all };
    };
    const first = run("fixed-seed");
    const second = run("fixed-seed");
    expect(second.ledgerHash).toBe(first.ledgerHash);
    expect(second.outcome.triggered).toEqual(first.outcome.triggered);
    expect(first.decisions.map((d) => d.streamId)).toEqual([
      PRIVATE_DOCK_EXPANSION_STREAM_FAMILY,
      PRIVATE_DOCK_EXPANSION_STREAM_FAMILY,
    ]);
    expect(first.decisions[0]!.entityKey).toBe("AAA-home");
    expect(first.decisions[1]!.entityKey).toBe("BBB-home");
    for (const decision of first.decisions) {
      expect(decision.rulesetVersion).toBe(PRIVATE_DOCK_EXPANSION_EVENT_ID);
      expect(decision.draw).toBeGreaterThanOrEqual(0);
      expect(decision.draw).toBeLessThan(10_000);
    }
  });

  it("draws no decision at all when no nation is eligible", () => {
    const ledger = new RandomLedger();
    const outcome = resolvePrivateDockExpansion({
      snapshot: snapshot([nation("AAA"), nation("BBB")]),
      campaignMonth: "1880-06",
      randomEngine: new RandomEngine("seed"),
      randomLedger: ledger,
    });
    expect(outcome.decisions).toEqual([]);
    expect(ledger.all).toEqual([]);
    expect(outcome.snapshot.nations.get("AAA")!.dockExpansion).toBeUndefined();
  });

  it("a successful event creates a NORMAL expansion project rather than immediate dock growth", () => {
    const from = snapshot([eligibleNation("AAA", { dock: DOCK })]);
    let triggered = false;
    for (let i = 0; i < 200 && !triggered; i++) {
      const ledger = new RandomLedger();
      const outcome = resolvePrivateDockExpansion({
        snapshot: from,
        campaignMonth: "1880-06",
        randomEngine: new RandomEngine(`seed-${String(i)}`),
        randomLedger: ledger,
      });
      if (outcome.triggered.length === 0) continue;
      triggered = true;
      const nationAfter = outcome.snapshot.nations.get("AAA")!;
      expect(nationAfter.dock).toEqual(DOCK);
      const project = nationAfter.constructionProjects.find(
        (p) => p.id === outcome.triggered[0]!.projectId,
      )!;
      expect(project.projectType).toBe(DOCK_EXPANSION_PROJECT_TYPE);
      expect(project.dockExpansionStepKg).toBe(1_000_000);
      expect(project.dockExpansionDurationMonths).toBe(12);
      expect(project.elapsedActiveMonths).toBe(0);
      expect(project.paidWork).toBe(0);
      expect(nationAfter.dockExpansion?.lastOpportunityMonth).toBe("1880-06");
      expect(ledger.all).toHaveLength(1);
    }
    expect(triggered).toBe(true);
  });

  it("uses the documented threshold and cooldown constants", () => {
    expect(PRIVATE_DOCK_EXPANSION_MIN_UTILIZATION_BP).toBe(7_500);
    expect(PRIVATE_DOCK_EXPANSION_COOLDOWN_MONTHS).toBe(60);
  });
});
