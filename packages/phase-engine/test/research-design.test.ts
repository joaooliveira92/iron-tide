import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { TEST_RESEARCH_CATALOGUE } from "./research-catalogue.helper.js";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function makeResearchNation(
  id: string,
  overrides: Partial<{
    treasury: SafeInt;
    researchBudget: SafeInt;
    techs: { techId: string; investedPoints: SafeInt; completed: boolean }[];
    priorities: Record<string, SafeInt>;
    constructions: ConstructionProject[];
    baseResources: SafeInt;
  }>,
): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: overrides.treasury ?? SafeInt(1000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: overrides.baseResources ?? SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: overrides.techs ?? [],
      fieldPriorities: overrides.priorities ?? {},
      researchBudget: overrides.researchBudget ?? SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: overrides.constructions ?? [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

const ALL_FIELDS = [
  "HULL_CONSTRUCTION",
  "MACHINERY",
  "SHIP_DESIGN",
  "GUNNERY",
  "FIRE_CONTROL",
  "TORPEDOES",
  "SUBMARINES",
  "MINES_AND_ASW",
  "AVIATION",
  "CARRIER_OPERATIONS",
  "RADAR_AND_ELECTRONICS",
  "MISSILES",
  "AMPHIBIOUS_OPERATIONS",
  "INFRASTRUCTURE",
  "DAMAGE_CONTROL",
] as const;

function defaultPriorities(): Record<string, SafeInt> {
  const p: Record<string, SafeInt> = {};
  for (const f of ALL_FIELDS) p[f] = SafeInt(1);
  p["MACHINERY"] = SafeInt(4);
  p["HULL_CONSTRUCTION"] = SafeInt(2);
  return p;
}

function makeSnapshot(
  nations: Map<string, NationState>,
  designs = new Map<string, CompiledDesignVersion>(),
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "research-acceptance",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [...nations.keys()].map((nationId) => ({
      nationId,
      type: nationId === "GBR" ? ("playable" as const) : ("ai" as const),
    })),
    world: { areas: [], routes: [], ports: [], technologies: TEST_RESEARCH_CATALOGUE },
    nations,
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs,
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

function makePriorityCommand(
  nationId: string,
  priorities: Record<string, SafeInt>,
  snapshot: CampaignSnapshot,
): CommandEnvelope<CommandBody> {
  return {
    commandId: `prio-${nationId}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `ik-prio-${nationId}`,
    timestamp: "test",
    body: { type: "SetResearchPriority", nationId, fieldPriorities: priorities },
  };
}

function runMonth(
  snapshot: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[],
  seed = "research-seed",
) {
  const executor = new MonthExecutor();
  const collector = new DiagnosticCollector();
  const result = executor.execute(snapshot, commands, seed, collector);
  return { result, collector };
}

describe("B10b research acceptance (criteria 1-10)", () => {
  it("C1: runs a full monthly turn with research resolution for all 3 nations (GBR, FRA, GER)", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const fra = makeResearchNation("FRA", {
      researchBudget: SafeInt(60),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
      treasury: SafeInt(800),
    });
    const ger = makeResearchNation("GER", {
      researchBudget: SafeInt(40),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
      treasury: SafeInt(600),
    });

    const snapshot = makeSnapshot(
      new Map([
        ["GBR", gbr],
        ["FRA", fra],
        ["GER", ger],
      ]),
    );
    const { result, collector } = runMonth(snapshot, []);

    expect(result.success).toBe(true);
    expect(collector.hasErrors).toBe(false);

    for (const nationId of ["GBR", "FRA", "GER"]) {
      const final = result.finalSnapshot.nations.get(nationId)!;
      expect(final.research.researchBudget as number).toBe(0);
      const spendEntries = result.financialLedger.all.filter(
        (e) => e.nationId === nationId && e.categoryId === "RESEARCH_EXPENDITURE",
      );
      expect(spendEntries.length).toBeGreaterThan(0);
    }
  });

  it("C2: research expenditure is deducted from treasury and recorded as a balanced RESEARCH_EXPENDITURE posting", () => {
    const gbr = makeResearchNation("GBR", {
      treasury: SafeInt(1000),
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const { result } = runMonth(snapshot, []);

    const final = result.finalSnapshot.nations.get("GBR")!;
    expect(final.treasury as number).toBeLessThan(1000);

    const spendEntries = result.financialLedger.all.filter(
      (e) => e.nationId === "GBR" && e.categoryId === "RESEARCH_EXPENDITURE",
    );
    expect(spendEntries.length).toBeGreaterThan(0);
    for (const entry of spendEntries) {
      expect(entry.debit as number).toBe(entry.credit as number);
      expect(entry.debit as number).toBeGreaterThan(0);
    }
  });

  it("C3: research resources are zero when paid expenditure is zero; positive expenditure is proportional to researchResourceConversionBp (10_000)", () => {
    const gbrZero = makeResearchNation("GBR", {
      researchBudget: SafeInt(0),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: { MACHINERY: SafeInt(4) },
    });
    const zeroSnapshot = makeSnapshot(new Map([["GBR", gbrZero]]));
    const zeroRun = runMonth(zeroSnapshot, []).result;
    expect(zeroRun.success).toBe(true);
    const gbrZeroFinal = zeroRun.finalSnapshot.nations.get("GBR")!;
    for (const tech of gbrZeroFinal.research.technologies) {
      expect(tech.investedPoints as number).toBe(0);
    }
    expect(
      zeroRun.financialLedger.all.some(
        (e) => e.nationId === "GBR" && e.categoryId === "RESEARCH_EXPENDITURE",
      ),
    ).toBe(false);

    const gbrPos = makeResearchNation("GBR", {
      treasury: SafeInt(1000),
      researchBudget: SafeInt(100),
      techs: [{ techId: "basic_steam", investedPoints: SafeInt(0), completed: false }],
      priorities: {
        MACHINERY: SafeInt(4),
        HULL_CONSTRUCTION: SafeInt(0),
        GUNNERY: SafeInt(0),
      },
    });
    const posSnapshot = makeSnapshot(new Map([["GBR", gbrPos]]));
    const posRun = runMonth(posSnapshot, []).result;
    const gbrPosFinal = posRun.finalSnapshot.nations.get("GBR")!;
    const spentTech = gbrPosFinal.research.technologies.find((t) => t.techId === "basic_steam")!;
    expect(spentTech.investedPoints as number).toBe(100);
  });

  it("C4: SetResearchPriorityCommand sets priorities effective at the next RESOLVE_RESEARCH phase", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));

    const newPriorities = defaultPriorities();
    newPriorities["GUNNERY"] = SafeInt(4);
    newPriorities["MACHINERY"] = SafeInt(1);
    const cmd = makePriorityCommand("GBR", newPriorities, snapshot);

    const { result } = runMonth(snapshot, [cmd]);

    const final = result.finalSnapshot.nations.get("GBR")!;
    expect(final.research.fieldPriorities["GUNNERY"] as number).toBe(4);
    expect(final.research.fieldPriorities["MACHINERY"] as number).toBe(1);
    const gunnery = final.research.technologies.find((t) => t.techId === "basic_gunnery")!;
    const machinery = final.research.technologies.find((t) => t.techId === "basic_steam")!;
    expect(gunnery.investedPoints as number).toBeGreaterThan(machinery.investedPoints as number);
  });

  it("C6: eligible fields receive largest-remainder proportional allocation summing exactly to resources", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const { result } = runMonth(snapshot, []);

    const final = result.finalSnapshot.nations.get("GBR")!;
    const totalInvested = final.research.technologies.reduce(
      (sum, t) => sum + (t.investedPoints as number),
      0,
    );
    expect(totalInvested).toBe(100);

    const machinery = final.research.technologies.find((t) => t.techId === "basic_steam")!;
    const hull = final.research.technologies.find((t) => t.techId === "basic_hull")!;
    const gunnery = final.research.technologies.find((t) => t.techId === "basic_gunnery")!;
    expect(machinery.investedPoints as number).toBe(57);
    expect(hull.investedPoints as number).toBe(29);
    expect(gunnery.investedPoints as number).toBe(14);
  });

  it("C7: each field has at most one active candidate receiving progress; progress never exceeds cost", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(99), completed: false },
        { techId: "advanced_hull", investedPoints: SafeInt(99), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: {
        HULL_CONSTRUCTION: SafeInt(4),
        MACHINERY: SafeInt(1),
      },
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const { result } = runMonth(snapshot, []);

    const final = result.finalSnapshot.nations.get("GBR")!;
    for (const tech of final.research.technologies) {
      expect(tech.investedPoints as number).toBeLessThanOrEqual(100);
    }
    const hullTechs = final.research.technologies.filter((t) =>
      ["basic_hull", "advanced_hull"].includes(t.techId),
    );
    const advanced = hullTechs.find((t) => t.techId === "advanced_hull")!;
    expect(advanced.investedPoints as number).toBe(99);
  });

  it("C8: a technology with progress equal to cost is discovered in the same phase with IMMEDIATE_KNOWLEDGE and revalidation", () => {
    const gbr = makeResearchNation("GBR", {
      treasury: SafeInt(1000),
      researchBudget: SafeInt(100),
      techs: [{ techId: "basic_steam", investedPoints: SafeInt(99), completed: false }],
      priorities: { MACHINERY: SafeInt(4) },
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const { result, collector } = runMonth(snapshot, []);

    expect(result.success).toBe(true);
    expect(collector.hasErrors).toBe(false);

    const final = result.finalSnapshot.nations.get("GBR")!;
    expect(final.research.discoveredTechs).toContain("basic_steam");
    const steam = final.research.technologies.find((t) => t.techId === "basic_steam")!;
    expect(steam.completed).toBe(true);
    expect(steam.investedPoints as number).toBe(100);

    const discoveryEvents = result.eventLedger.all.filter(
      (e) => e.eventType === "TechnologyDiscovered" && e.aggregateId === "basic_steam",
    );
    expect(discoveryEvents.length).toBeGreaterThan(0);
  });

  it("C9: discovery selection uses the keyed stream research/month/{nation}/{field} and is deterministic", () => {
    const gbr1 = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr1]]));

    const run1 = runMonth(snapshot, [], "keyed-seed").result;
    const run2 = runMonth(snapshot, [], "keyed-seed").result;

    const streamIds = run1.randomLedger.all.map((r) => (r as { streamId?: string }).streamId ?? "");
    expect(streamIds.some((s) => s.startsWith("research/month/GBR/"))).toBe(true);

    const hash1 = sha256Hex(canonicalSerialize(run1.finalSnapshot));
    const hash2 = sha256Hex(canonicalSerialize(run2.finalSnapshot));
    expect(hash1).toBe(hash2);
    expect(run1.randomLedger.hash()).toBe(run2.randomLedger.hash());
  });

  it("C10: a technology whose prerequisite is undiscovered stays ineligible; the budget goes to the prerequisite", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [{ techId: "advanced_steam", investedPoints: SafeInt(0), completed: false }],
      priorities: {
        MACHINERY: SafeInt(4),
        HULL_CONSTRUCTION: SafeInt(0),
        GUNNERY: SafeInt(0),
      },
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const { result, collector } = runMonth(snapshot, []);

    expect(result.success).toBe(true);
    expect(collector.errors.length).toBe(0);
    const final = result.finalSnapshot.nations.get("GBR")!;
    const advanced = final.research.technologies.find((t) => t.techId === "advanced_steam")!;
    expect(advanced.investedPoints as number).toBe(0);
    const basic = final.research.technologies.find((t) => t.techId === "basic_steam")!;
    expect(basic.investedPoints as number).toBe(100);
  });

  it("C15: research resolution is deterministic for a fixed seed (replay produces identical snapshots and hashes)", () => {
    const gbr = makeResearchNation("GBR", {
      researchBudget: SafeInt(100),
      techs: [
        { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
        { techId: "basic_gunnery", investedPoints: SafeInt(0), completed: false },
      ],
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));

    const run1 = runMonth(snapshot, [], "replay-seed").result;
    const run2 = runMonth(snapshot, [], "replay-seed").result;

    expect(sha256Hex(canonicalSerialize(run1.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(run2.finalSnapshot)),
    );
    expect(run1.eventLedger.hash()).toBe(run2.eventLedger.hash());
    expect(run1.financialLedger.hash()).toBe(run2.financialLedger.hash());
    expect(run1.randomLedger.hash()).toBe(run2.randomLedger.hash());
  });
});

describe("B10b design acceptance (criteria 12-13)", () => {
  it("C12/C13: construction referencing a compiled design builds a Ship with the design's compiled attributes", () => {
    const design: CompiledDesignVersion = {
      designVersionId: "gbr-dreadnought-v1",
      designFamilyId: "dreadnought",
      className: "Dreadnought-class",
      nationId: "GBR",
      hullType: "battleship",
      normalizedDisplacementKg: SafeInt(18000),
      normalizedSpeedUms: SafeInt(11 * 514_444),
      normalizedArmorUm: SafeInt(300 * 1000),
      hitPoints: SafeInt(120),
      mainGunsCaliber: SafeInt(305 * 1000),
      mainGunsCount: SafeInt(10),
      machineryType: "steam_turbine",
      crewComplement: SafeInt(800),
      contentVersion: "0.1.0",
      compiledHash: "abc123",
    };

    const construction: ConstructionProject = {
      id: "proj-dreadnought",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "ship-dreadnought-1",
      designVersionId: "gbr-dreadnought-v1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(100),
      paidWork: SafeInt(100),
      status: "ACTIVE",
      startedAt: "1880-01",
    };

    const gbr = makeResearchNation("GBR", {
      treasury: SafeInt(10000),
      constructions: [construction],
    });
    const snapshot = makeSnapshot(
      new Map([["GBR", gbr]]),
      new Map([["gbr-dreadnought-v1", design]]),
    );
    const { result } = runMonth(snapshot, []);

    const final = result.finalSnapshot.nations.get("GBR")!;
    const fleet = final.fleets[0]!;
    const ship = fleet.ships[0]!;
    expect(ship.designVersionId).toBe("gbr-dreadnought-v1");
    expect(ship.hitPoints as number).toBe(120);
    expect(ship.speed as number).toBe(11);
    expect(ship.armor as number).toBe(300);
    expect(ship.firepower as number).toBe(30);
    expect(ship.classId).toBe("Dreadnought-class");
    expect(ship.isUnderConstruction).toBe(false);
  });
});

describe("SetBudgetAllocation", () => {
  const techs = () => [
    { techId: "basic_hull", investedPoints: SafeInt(0), completed: false },
    { techId: "basic_steam", investedPoints: SafeInt(0), completed: false },
  ];
  const command = (snapshot: CampaignSnapshot, rate: number, research: number) =>
    ({
      commandId: "alloc-1",
      version: "0.1.0",
      expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
      idempotencyKey: "ik-alloc-1",
      timestamp: "test",
      body: {
        type: "SetBudgetAllocation",
        nationId: "GBR",
        appropriationRateBp: SafeInt(rate),
        researchBudget: SafeInt(research),
      },
    }) as CommandEnvelope<CommandBody>;

  it("sets the appropriation rate and keeps paying the research budget every month", () => {
    const gbr = makeResearchNation("GBR", {
      treasury: SafeInt(1000),
      baseResources: SafeInt(120000),
      techs: techs(),
      priorities: defaultPriorities(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    const first = runMonth(snapshot, [command(snapshot, 3000, 80)]);
    expect(first.result.success).toBe(true);
    const afterFirst = first.result.finalSnapshot.nations.get("GBR")!;
    expect(afterFirst.navalAppropriationRateBp as number).toBe(3000);
    expect(afterFirst.research.standingResearchBudget as number).toBe(80);
    expect(afterFirst.research.researchBudget as number).toBe(80);

    const second = runMonth(first.result.finalSnapshot, []);
    const spent = second.result.financialLedger.all.filter(
      (e) => e.nationId === "GBR" && e.categoryId === "RESEARCH_EXPENDITURE",
    );
    expect(spent.some((e) => (e.debit as number) === 80)).toBe(true);
  });

  it("refuses a research budget above 12% of the monthly revenue at the commanded rate", () => {
    const gbr = makeResearchNation("GBR", {
      treasury: SafeInt(1000),
      baseResources: SafeInt(120000),
      techs: techs(),
    });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));

    const over = runMonth(snapshot, [command(snapshot, 3000, 361)]);
    const refused = over.result.finalSnapshot.nations.get("GBR")!;
    expect(refused.navalAppropriationRateBp as number).toBe(2000);
    expect(refused.research.standingResearchBudget).toBeUndefined();
    const ledger = JSON.stringify(over.result.commandLedger.all);
    expect(ledger).toContain("RESEARCH_ABOVE_CAP");
    expect(ledger).toContain("cap of 360");

    const atCap = runMonth(snapshot, [command(snapshot, 3000, 360)]);
    const accepted = atCap.result.finalSnapshot.nations.get("GBR")!;
    expect(accepted.research.standingResearchBudget as number).toBe(360);
    expect(atCap.collector.errors.map((d) => d.code)).not.toContain("RESEARCH_ABOVE_CAP");
  });

  it("rejects out-of-range allocations and leaves the nation unchanged", () => {
    const gbr = makeResearchNation("GBR", { techs: techs(), priorities: defaultPriorities() });
    const snapshot = makeSnapshot(new Map([["GBR", gbr]]));
    for (const [rate, research] of [
      [100, 10],
      [9000, 10],
      [2000, -1],
      [2000, 100000],
    ] as const) {
      const { result } = runMonth(snapshot, [command(snapshot, rate, research)]);
      const nation = result.finalSnapshot.nations.get("GBR")!;
      expect(nation.navalAppropriationRateBp as number).toBe(2000);
      expect(nation.research.standingResearchBudget).toBeUndefined();
    }
  });
});
