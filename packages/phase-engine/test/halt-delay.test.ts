import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { assertValidDefinitionOrThrow } from "@bluewave/commands";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { LINE_IDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  HALT_CONSTRUCTION_COMMAND_DEFINITION,
  RESUME_CONSTRUCTION_COMMAND_DEFINITION,
} from "../src/commandLifecycle.js";
import {
  applyBudgetProject,
  applyHaltConstruction,
  applyResumeConstruction,
} from "../src/commands.js";
import {
  CONSTRUCTION_RESUMED_AWAITING_CAPACITY,
  CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD,
  CONSTRUCTION_RESUMED_WITH_CAPACITY,
  constructionResumeTarget,
} from "../src/constructionHaltResume.js";
import { constructionProjectReadout } from "../src/constructionReadout.js";
import { PROJECT_DELAYED_ZERO_WORK, preservationCostUnits } from "../src/economyPhases.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { MonthExecutor } from "../src/index.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const productionBalance = content.environmentFor("1880-02").constructionBalance;

interface ProjectOverrides {
  readonly id?: string;
  readonly status?: ConstructionProject["status"];
  readonly totalWork?: number;
  readonly completedWork?: number;
  readonly designVersionId?: string;
}

function project(over: ProjectOverrides = {}): ConstructionProject {
  return {
    id: over.id ?? "proj-1",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: over.designVersionId ?? "",
    totalWork: SafeInt(over.totalWork ?? 200),
    completedWork: SafeInt(over.completedWork ?? 0),
    paidWork: SafeInt(0),
    status: over.status ?? "ACTIVE",
    startedAt: "1880-01",
  };
}

const capacityUnits = (perLine: number): Record<string, SafeInt> =>
  Object.fromEntries(LINE_IDS.map((line) => [line, SafeInt(perLine)]));

/** A compiled design whose construction plan grants `perLine` capacity on every line. */
function design(perLine: number, id = "d1"): CompiledDesignVersion {
  return {
    designVersionId: id,
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
    constructionCostUnits: SafeInt(600),
    constructionPlan: { yardId: "yard_small", packages: [], capacityUnits: capacityUnits(perLine) },
  } as CompiledDesignVersion;
}

function nation(projects: ConstructionProject[], baseResources = 0): NationState {
  return {
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(1_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(baseResources),
    navalAppropriationRateBp: SafeInt(2_000),
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
  };
}

function snapshot(
  projects: ConstructionProject[],
  designs: Map<string, CompiledDesignVersion> = new Map(),
  baseResources = 0,
): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "halt-delay",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation(projects, baseResources)]]),
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
    compatibilityVersion: "1.2.0",
  };
}

const envelope = (body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}`,
  timestamp: "test",
  body,
});

const executeMonth = (from: CampaignSnapshot, commands: CommandEnvelope<CommandBody>[] = []) =>
  new MonthExecutor().execute(from, commands, "seed", new DiagnosticCollector(), undefined, {
    shipBuilding: content,
  });

describe("halt, resume and delay command definitions (SB3-R5)", () => {
  it("the halt and resume definitions are valid and registered models", () => {
    expect(() => assertValidDefinitionOrThrow(HALT_CONSTRUCTION_COMMAND_DEFINITION)).not.toThrow();
    expect(() =>
      assertValidDefinitionOrThrow(RESUME_CONSTRUCTION_COMMAND_DEFINITION),
    ).not.toThrow();
    expect(HALT_CONSTRUCTION_COMMAND_DEFINITION.targetAggregateType).toBe("construction");
    expect(RESUME_CONSTRUCTION_COMMAND_DEFINITION.reservationPolicyId).toBe("none");
  });
});

describe("constructionResumeTarget (SB3-R5)", () => {
  it("activates with usable capacity, waits without it, and records why when no plan exists", () => {
    expect(constructionResumeTarget(design(25))).toMatchObject({
      status: "ACTIVE",
      reason: CONSTRUCTION_RESUMED_WITH_CAPACITY,
    });
    expect(constructionResumeTarget(design(0))).toMatchObject({
      status: "AWAITING_CAPACITY",
      reason: CONSTRUCTION_RESUMED_AWAITING_CAPACITY,
    });
    expect(constructionResumeTarget(undefined)).toMatchObject({
      status: "ACTIVE",
      reason: CONSTRUCTION_RESUMED_NO_CAPACITY_RECORD,
    });
  });
});

describe("applyHaltConstruction / applyResumeConstruction (SB3-R5)", () => {
  it("halts an active project through the shared transition table", () => {
    const next = applyHaltConstruction(
      snapshot([project()]),
      { type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" },
      new DiagnosticCollector(),
    );
    expect(next.nations.get("GBR")!.constructionProjects[0]!.status).toBe("HALTED");
  });

  it("resumes a halted project to ACTIVE when its design has capacity", () => {
    const collector = new DiagnosticCollector();
    const next = applyResumeConstruction(
      snapshot(
        [project({ status: "HALTED", designVersionId: "d1" })],
        new Map([["d1", design(25)]]),
      ),
      { type: "ResumeConstruction", nationId: "GBR", projectId: "proj-1" },
      collector,
    );
    expect(next.nations.get("GBR")!.constructionProjects[0]!.status).toBe("ACTIVE");
    expect(collector.all.some((d) => d.code === CONSTRUCTION_RESUMED_WITH_CAPACITY)).toBe(true);
  });

  it("parks a resumed project in AWAITING_CAPACITY when its design has no capacity", () => {
    const next = applyResumeConstruction(
      snapshot(
        [project({ status: "HALTED", designVersionId: "d1" })],
        new Map([["d1", design(0)]]),
      ),
      { type: "ResumeConstruction", nationId: "GBR", projectId: "proj-1" },
      new DiagnosticCollector(),
    );
    expect(next.nations.get("GBR")!.constructionProjects[0]!.status).toBe("AWAITING_CAPACITY");
  });

  it("applyBudgetProject refuses a halted project: zero work, zero charge", () => {
    const snap = snapshot([project({ status: "HALTED" })]);
    const collector = new DiagnosticCollector();
    const next = applyBudgetProject(
      snap,
      { type: "budget_project", nationId: "GBR", projectId: "proj-1", budget: SafeInt(100) },
      "1880-02",
      SafeInt(0),
      () => SafeInt(0),
      new FinancialLedger(),
      new EventLedger(),
      collector,
    );
    expect(next).toBe(snap);
    expect(collector.errors.map((e) => e.code)).toContain("PROJECT_NOT_ACTIVE");
  });
});

describe("a HALTED month (SB3-R5)", () => {
  it("takes zero work and zero ordinary charge and pays half the mothballed maintenance", () => {
    const from = snapshot([project()]);
    const result = executeMonth(from, [
      envelope({ type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" }, from),
    ]);
    const final = result.finalSnapshot.nations.get("GBR")!;
    const p = final.constructionProjects[0]!;
    expect(p.status).toBe("HALTED");
    expect(p.completedWork).toBe(0);
    expect(p.paidWork).toBe(0);
    const expected = preservationCostUnits(productionBalance, content.treasuryUnitMicro);
    expect(expected).toBeGreaterThan(0);
    expect(1000 - (final.treasury as number)).toBe(expected);
    expect(
      result.financialLedger.all.some((e) => e.categoryId === "CONSTRUCTION_PRESERVATION"),
    ).toBe(true);
    expect(result.financialLedger.all.some((e) => e.categoryId === "APPROPRIATION")).toBe(false);
  });

  it("is deterministic: a second identical halt run matches exactly", () => {
    const run = () => {
      const from = snapshot([project()]);
      return executeMonth(from, [
        envelope({ type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" }, from),
      ]);
    };
    const a = run();
    const b = run();
    expect(sha256Hex(canonicalSerialize(a.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.finalSnapshot)),
    );
    expect(a.financialLedger.hash()).toBe(b.financialLedger.hash());
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
  });
});

describe("a DELAYED month (SB3-R6)", () => {
  it("charges nothing, applies no work and writes exactly one delay record with a reason", () => {
    const from = snapshot([project({ status: "DELAYED" })]);
    const result = executeMonth(from);
    const final = result.finalSnapshot.nations.get("GBR")!;
    const p = final.constructionProjects[0]!;
    expect(p.completedWork).toBe(0);
    expect(p.paidWork).toBe(0);
    expect(final.treasury).toBe(from.nations.get("GBR")!.treasury);
    const delays = result.eventLedger.all.filter((e) => e.eventType === "ConstructionDelayed");
    expect(delays.length).toBe(1);
    expect(delays[0]!.body).toMatchObject({
      projectId: "proj-1",
      nationId: "GBR",
      reason: PROJECT_DELAYED_ZERO_WORK,
      delayMonth: "1880-02",
    });
    // The delay lasts exactly one month, so the project is active again after it.
    expect(p.status).toBe("ACTIVE");
  });

  it("the month after a delay resumes charged work", () => {
    const first = executeMonth(snapshot([project({ status: "DELAYED" })]));
    const advanced: CampaignSnapshot = {
      ...first.finalSnapshot,
      turnNumber: SafeInt.add(first.finalSnapshot.turnNumber, SafeInt(1)),
    };
    const gbr = advanced.nations.get("GBR")!;
    const funded: CampaignSnapshot = {
      ...advanced,
      nations: new Map(advanced.nations).set("GBR", { ...gbr, baseResources: SafeInt(120_000) }),
    };
    const second = executeMonth(funded);
    const p = second.finalSnapshot.nations.get("GBR")!.constructionProjects[0]!;
    expect(p.completedWork as number).toBeGreaterThan(0);
    expect(second.financialLedger.all.some((e) => e.categoryId === "APPROPRIATION")).toBe(true);
  });
});

describe("constructionProjectReadout (SB3-R31)", () => {
  it("derives instalment, remaining months, total cost and launch month from the compiled design", () => {
    const readout = constructionProjectReadout(
      project({ totalWork: 600, designVersionId: "d1" }),
      design(25),
      "1880-01",
    );
    expect(readout.totalCostUnits).toBe(600);
    expect(readout.monthlyInstalmentUnits).toBe(150); // six lines x 25 capacity
    expect(readout.remainingMonths).toBe(4);
    expect(readout.launchMonth).toBe("1880-05");
  });

  it("reports no launch month for a finished project", () => {
    const readout = constructionProjectReadout(
      project({ totalWork: 600, completedWork: 600 }),
      undefined,
      "1880-01",
    );
    expect(readout.remainingMonths).toBe(0);
    expect(readout.launchMonth).toBeNull();
  });
});
