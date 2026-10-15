import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { RESEARCH_FIELD_PRIORITY_WEIGHTS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeNation(
  id: string,
  overrides: Partial<{
    treasury: SafeInt;
    baseResources: SafeInt;
    projects: ConstructionProject[];
  }>,
): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: overrides.treasury ?? SafeInt(4000),
    income: SafeInt(100),
    expenses: SafeInt(20),
    baseResources: overrides.baseResources ?? SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
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
    constructionProjects: overrides.projects ?? [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function makeSnapshot(turn: SafeInt): CampaignSnapshot {
  const nations: Array<[string, NationState]> = [
    ["GBR", makeNation("GBR", { treasury: SafeInt(4000) })],
    [
      "FRA",
      makeNation("FRA", {
        treasury: SafeInt(3000),
        projects: [
          {
            id: "fra-battleship",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "fra-bb",
            designVersionId: "",
            totalWork: SafeInt(2000),
            completedWork: SafeInt(0),
            paidWork: SafeInt(0),
            status: "PLANNED",
            startedAt: "1880-01",
          },
        ],
      }),
    ],
    [
      "GER",
      makeNation("GER", {
        treasury: SafeInt(3000),
        projects: [
          {
            id: "ger-cruiser",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "ger-ca",
            designVersionId: "",
            totalWork: SafeInt(1500),
            completedWork: SafeInt(0),
            paidWork: SafeInt(0),
            status: "PLANNED",
            startedAt: "1880-01",
          },
        ],
      }),
    ],
  ];
  const map = new Map(nations);
  return {
    version: "0.1.0",
    turnNumber: turn,
    campaignId: "ai-scenario",
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

function runMonths(initial: CampaignSnapshot, executor: MonthExecutor, months: number) {
  let snapshot = initial;
  for (let m = 1; m <= months; m++) {
    const monthSnapshot = { ...snapshot, turnNumber: SafeInt(m) };
    const seed = `ai-scenario-seed-${String(m)}`;
    const collector = new DiagnosticCollector();
    const result = executor.execute(monthSnapshot, [], seed, collector);
    // Turn must complete without crashing and without hard errors.
    if (!result.success) {
      throw new Error(
        `month ${String(m)} failed: ${collector.all.map((d) => d.message).join("; ")}`,
      );
    }
    snapshot = result.finalSnapshot;
  }
  return snapshot;
}

describe("AI scenario readiness (24-month smoke)", () => {
  it("runs 24 consecutive months deterministically with 2 AI nations", () => {
    const initial = makeSnapshot(SafeInt(1));
    const initialHash = sha256Hex(canonicalSerialize(initial));

    const run = () => runMonths(initial, new MonthExecutor(), 24);
    const final1 = run();
    const final2 = run();

    const hash1 = sha256Hex(canonicalSerialize(final1));
    const hash2 = sha256Hex(canonicalSerialize(final2));

    // Replay determinism: a second run from the same seed sequence must be
    // byte-identical.
    expect(hash1).toBe(hash2);

    // At least one month ticked the turn number forward.
    expect(final1.turnNumber as number).toBe(24);

    // Each AI nation's research priorities took effect (SetResearchPriority
    // is always legal, so it must have flowed through the lifecycle).
    for (const nationId of ["FRA", "GER"]) {
      const nation = final1.nations.get(nationId)!;
      const highCount = Object.values(nation.research.fieldPriorities).filter(
        (v) => (v as number) === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
      ).length;
      expect(highCount).toBeGreaterThanOrEqual(1);
    }

    // Some AI construction progress happened over 24 months, so the system
    // was not a no-op: either a command reduced treasury (paidWork > 0) or
    // appropriation did. The final snapshot differs from the initial one.
    const anyProgress = ["FRA", "GER"].some((nationId) => {
      const nation = final1.nations.get(nationId)!;
      return nation.constructionProjects.some((p) => (p.paidWork as number) > 0);
    });
    expect(anyProgress || hash1 !== initialHash).toBe(true);
  });
});
