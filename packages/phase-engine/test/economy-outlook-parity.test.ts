import { economyOutlook } from "@bluewave/campaign";
import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { preservationCostUnits } from "../src/economyPhases.js";
import { MonthExecutor } from "../src/index.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

function project(
  id: string,
  over: Partial<ConstructionProject> & { remaining?: number } = {},
): ConstructionProject {
  const { remaining, ...rest } = over;
  const total = (remaining ?? 400) + 100;
  return {
    id,
    type: "ship",
    projectType: "REBUILD",
    targetId: `ship-${id}`,
    designVersionId: "",
    totalWork: SafeInt(total),
    completedWork: SafeInt(100),
    paidWork: SafeInt(100),
    status: "ACTIVE",
    startedAt: "1880-01",
    ...rest,
  } as ConstructionProject;
}

function nation(over: Partial<NationState>): NationState {
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
    fleets: [],
    divisions: [],
    research: {
      nationId: "n",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      standingResearchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...over,
  };
}

function snapshot(n: NationState): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "outlook-parity",
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

const content = productionShipBuildingContent({ navalProfiles: true });
const MONTH = "1880-01";
const CARRYING = preservationCostUnits(
  content.environmentFor(MONTH).constructionBalance,
  content.treasuryUnitMicro,
);

function packaged(id: string, over: Partial<ConstructionProject> = {}): ConstructionProject {
  const packages = [
    { id: "hull", kind: "HULL", line: "slipway", total: 120, dependsOn: [] as string[] },
    { id: "machinery", kind: "MACHINERY", line: "machinery", total: 80, dependsOn: [] },
    { id: "fit_out", kind: "FIT_OUT", line: "quay", total: 100, dependsOn: ["hull", "machinery"] },
  ] as const;
  return {
    id,
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: `ship-${id}`,
    designVersionId: "",
    totalWork: SafeInt(300),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: MONTH,
    capacityUnits: { slipway: 40, machinery: 25, quay: 60 },
    packages: packages.map((p) => ({
      id: p.id,
      kind: p.kind,
      line: p.line,
      totalWork: SafeInt(p.total),
      doneWork: SafeInt(0),
      dependsOn: [...p.dependsOn],
    })),
    ...over,
  } as ConstructionProject;
}

function executed(snap: CampaignSnapshot, seed = "s1") {
  const result = new MonthExecutor().execute(snap, [], seed, new DiagnosticCollector(), undefined, {
    shipBuilding: content,
  });
  const paid = result.financialLedger.all
    .filter((entry) => entry.categoryId === "APPROPRIATION")
    .reduce((sum, entry) => sum + Number(entry.debit), 0);
  const preserved = result.financialLedger.all
    .filter((entry) => entry.categoryId === "CONSTRUCTION_PRESERVATION")
    .reduce((sum, entry) => sum + Number(entry.debit), 0);
  const draws = new Map(
    [...result.finalSnapshot.nations.get("n")!.constructionProjects].map((p) => [
      p.id,
      Number(p.paidWork),
    ]),
  );
  return { paid, preserved, draws };
}

const SCENARIOS: readonly [string, Partial<NationState>][] = [
  [
    "existing orders with ample funds",
    { constructionProjects: [project("a", { remaining: 120 }), project("b", { remaining: 200 })] },
  ],
  [
    "insufficient funds across several orders",
    {
      treasury: SafeInt(40),
      constructionProjects: [
        project("a", { remaining: 300 }),
        project("b", { remaining: 50 }),
        project("c", { remaining: 700 }),
      ],
    },
  ],
  [
    "an order placed this turn beside existing orders",
    {
      treasury: SafeInt(150),
      constructionProjects: [
        project("a", { remaining: 300 }),
        project("fresh", { remaining: 450, completedWork: SafeInt(0), paidWork: SafeInt(0) }),
      ],
    },
  ],
  [
    "a new construction order with no work packages",
    {
      constructionProjects: [
        project("a", { remaining: 200 }),
        project("unpaced", {
          projectType: "NEW_CONSTRUCTION",
          remaining: 300,
          completedWork: SafeInt(0),
          paidWork: SafeInt(0),
        }),
      ],
    },
  ],
  [
    "an accelerated order beside a normal one",
    {
      treasury: SafeInt(120),
      constructionProjects: [
        project("a", { remaining: 250 }),
        project("fast", { remaining: 250, status: "ACCELERATED" }),
      ],
    },
  ],
  [
    "a delayed order is skipped",
    {
      constructionProjects: [
        project("a", { remaining: 100 }),
        project("held", { remaining: 100, status: "DELAYED" }),
      ],
    },
  ],
  [
    "a halted order pays its carrying cost before construction",
    {
      treasury: SafeInt(160),
      constructionProjects: [
        project("a", { remaining: 300 }),
        project("halted", { remaining: 300, status: "HALTED" }),
      ],
    },
  ],
  [
    "a packaged order limited by line capacity beside a legacy order",
    {
      constructionProjects: [project("a", { remaining: 150 }), packaged("ship")],
    },
  ],
  [
    "a packaged order and a legacy order competing for scarce funds",
    {
      treasury: SafeInt(60),
      constructionProjects: [project("a", { remaining: 150 }), packaged("ship")],
    },
  ],
  [
    "a paced order takes only its monthly allowance",
    {
      constructionProjects: [
        packaged("paced", { buildMonths: 4 }),
        project("a", { remaining: 90 }),
      ],
    },
  ],
];

describe("economyOutlook construction forecast matches the economy phase", () => {
  for (const [name, over] of SCENARIOS) {
    it(`${name}: plannedConstruction and buildingPaid equal the appropriation debit`, () => {
      const snap = snapshot(nation(over));
      const outlook = economyOutlook(snap, "n", { carryingCostPerHaltedProject: CARRYING })!;
      const { paid, preserved } = executed(snap);
      expect(outlook.settlement.buildingPaid).toBe(paid);
      expect(outlook.plannedConstruction).toBe(paid);
      expect(outlook.settlement.carryingPaid).toBe(preserved);
    });

    it(`${name}: each project's forecast draw equals the work the phase paid it`, () => {
      const snap = snapshot(nation(over));
      const outlook = economyOutlook(snap, "n", { carryingCostPerHaltedProject: CARRYING })!;
      const { draws } = executed(snap);
      const before = new Map(
        snap.nations.get("n")!.constructionProjects.map((p) => [p.id, Number(p.paidWork)]),
      );
      const real = [...draws]
        .map(([id, paidWork]) => ({ projectId: id, draw: paidWork - (before.get(id) ?? 0) }))
        .filter((entry) => entry.draw > 0);
      expect(outlook.constructionDraws).toEqual(real);
    });
  }
});
