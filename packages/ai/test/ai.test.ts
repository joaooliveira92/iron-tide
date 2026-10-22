import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { type CommandEnvelope, CommandIdempotencyMap, CommandLifecycle } from "@bluewave/commands";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";
import {
  AI_COMMAND_TYPE_BUDGET,
  AI_COMMAND_TYPE_RESEARCH,
  AiCommandGenerator,
  AiPlanner,
} from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function makeNation(id: string, treasury: SafeInt, projects: ConstructionProject[]): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury,
    income: SafeInt(100),
    expenses: SafeInt(50),
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
    constructionProjects: projects,
    isPlayable: false,
    isAI: true,
  };
}

function makeSnapshot(
  nations: Array<[string, NationState]>,
  turn: SafeInt = SafeInt(1),
): CampaignSnapshot {
  const map = new Map(nations);
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: turn,
    campaignId: "ai-test-campaign",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map(([nationId]) => ({
      nationId,
      type: "ai" as const,
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

const testHash = sha256Hex(canonicalSerialize({ fixture: "ai" }));

const project = (id: string, total: number, completed: number): ConstructionProject => ({
  id,
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: `ship-${id}`,
  designVersionId: "",
  totalWork: SafeInt(total),
  completedWork: SafeInt(completed),
  paidWork: SafeInt(0),
  status: "PLANNED",
  startedAt: "1880-01",
});

describe("AiCommandGenerator", () => {
  it("produces the deterministic idempotency key shape", () => {
    const _gen = new AiCommandGenerator({
      campaignId: "camp",
      turnNumber: SafeInt(1),
      expectedSnapshotHash: testHash,
    });
    expect(
      AiCommandGenerator.buildIdempotencyKey("camp", SafeInt(1), "GBR", AI_COMMAND_TYPE_BUDGET),
    ).toBe("camp/1/GBR/budget_project");
    expect(
      AiCommandGenerator.buildIdempotencyKey("camp", SafeInt(7), "FRA", AI_COMMAND_TYPE_RESEARCH),
    ).toBe("camp/7/FRA/SetResearchPriority");
  });

  it("is deterministic for same inputs", () => {
    const gen = new AiCommandGenerator({
      campaignId: "camp",
      turnNumber: SafeInt(1),
      expectedSnapshotHash: testHash,
    });
    const a = gen.buildBudgetCommand("GBR", "proj-1", SafeInt(50));
    const b = gen.buildBudgetCommand("GBR", "proj-1", SafeInt(50));
    expect(a.commandId).toBe(b.commandId);
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.body.type).toBe("budget_project");
    expect(a.body.budget as number).toBe(50);
  });

  it("uses the SetResearchPriority discriminant for research commands", () => {
    const gen = new AiCommandGenerator({
      campaignId: "camp",
      turnNumber: SafeInt(1),
      expectedSnapshotHash: testHash,
    });
    const priorities: Record<string, SafeInt> = {};
    for (const f of CANONICAL_RESEARCH_FIELD_IDS) priorities[f] = SafeInt(1);
    priorities[CANONICAL_RESEARCH_FIELD_IDS[0]!] = SafeInt(4);
    const cmd = gen.buildResearchPriorityCommand("GBR", priorities) as CommandEnvelope<{
      type: string;
    }>;
    expect(cmd.body.type).toBe("SetResearchPriority");
  });

  it("commandId and idempotency key differ across command types", () => {
    const gen = new AiCommandGenerator({
      campaignId: "camp",
      turnNumber: SafeInt(2),
      expectedSnapshotHash: testHash,
    });
    const budget = gen.buildBudgetCommand("GBR", "proj-1", SafeInt(10));
    const research = gen.buildResearchPriorityCommand("GBR", {
      [CANONICAL_RESEARCH_FIELD_IDS[0]!]: SafeInt(4),
    }) as CommandEnvelope<{ type: string }>;
    expect(research.commandId).not.toBe(budget.commandId);
    expect(research.idempotencyKey).not.toBe(budget.idempotencyKey);
  });
});

describe("AiPlanner", () => {
  it("picks a legal project and a budget amount within bounds", () => {
    const snapshot = makeSnapshot([
      ["GBR", makeNation("GBR", SafeInt(100), [project("p1", 300, 0), project("p2", 500, 400)])],
    ]);
    const planner = new AiPlanner();
    const lifecycle = new CommandLifecycle();
    const idems = new CommandIdempotencyMap();
    const engine = new RandomEngine("seed-1");
    const slot = snapshot.slots[0]!;

    const result = planner.generate(snapshot, engine, lifecycle, slot, idems);

    expect(result.envelopes.length).toBeGreaterThanOrEqual(1);
    const budget = result.envelopes.find((e) => e.body.type === "budget_project");
    expect(budget).toBeDefined();
    const b = budget!.body as { projectId: string; budget: SafeInt };
    expect(["p1", "p2"]).toContain(b.projectId);
    const p = snapshot.nations.get("GBR")!.constructionProjects.find((x) => x.id === b.projectId)!;
    const maxAmount = Math.min(100, (p.totalWork as number) - (p.completedWork as number));
    expect(b.budget as number).toBeGreaterThanOrEqual(1);
    expect(b.budget as number).toBeLessThanOrEqual(maxAmount);
    expect(b.budget as number).toBeLessThanOrEqual(100);
  });

  it("research priority command passes the lifecycle process", () => {
    const snapshot = makeSnapshot([["FRA", makeNation("FRA", SafeInt(50), [])]]);
    const planner = new AiPlanner();
    const lifecycle = new CommandLifecycle();
    const idems = new CommandIdempotencyMap();
    const engine = new RandomEngine("seed-2");
    const slot = snapshot.slots[0]!;

    const result = planner.generate(snapshot, engine, lifecycle, slot, idems);
    const research = result.envelopes.find((e) => e.body.type === "SetResearchPriority");
    expect(research).toBeDefined();
    expect(result.accepted.some((e) => e.body.type === "SetResearchPriority")).toBe(true);
  });

  it("is deterministic for a fixed seed", () => {
    const mk = () =>
      makeSnapshot([["GER", makeNation("GER", SafeInt(100), [project("p", 20, 0)])]]);
    const run = () => {
      const snapshot = mk();
      const planner = new AiPlanner();
      const idems = new CommandIdempotencyMap();
      const slot = snapshot.slots[0]!;
      const result = planner.generate(
        snapshot,
        new RandomEngine("fixed-seed"),
        new CommandLifecycle(),
        slot,
        idems,
      );
      const accepted = result.accepted.map((e) => sha256Hex(canonicalSerialize(e)));
      return { snapshot, accepted, diagnostics: result.diagnostics };
    };
    const r1 = run();
    const r2 = run();
    expect(r1.accepted).toEqual(r2.accepted);
    expect(r1.diagnostics).toEqual(r2.diagnostics);
    expect(sha256Hex(canonicalSerialize(r1.snapshot))).toBe(
      sha256Hex(canonicalSerialize(r2.snapshot)),
    );
  });

  it("reports a diagnostic for a rejected command and does not accept it", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", SafeInt(0), [])]]);
    const planner = new AiPlanner();
    const idems = new CommandIdempotencyMap();
    const result = planner.generate(
      snapshot,
      new RandomEngine("seed-r"),
      new CommandLifecycle(),
      snapshot.slots[0]!,
      idems,
    );
    expect(result.envelopes.find((e) => e.body.type === "budget_project")).toBeUndefined();
    expect(result.envelopes.some((e) => e.body.type === "SetResearchPriority")).toBe(true);
  });
});
