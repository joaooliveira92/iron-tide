import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionPackage,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { campaignMonthId, transitionConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { LINE_IDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { assertValidDefinitionOrThrow } from "@bluewave/commands";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { MonthExecutor } from "../src/index.js";
import {
  SET_ACCELERATION_COMMAND_DEFINITION,
  SET_ACCELERATION_COMMAND_TYPE_ID,
} from "../src/commandLifecycle.js";
import {
  ACCELERATION_CAPACITY_PRESSURE_WEIGHT_BP,
  ACCELERATION_CAPACITY_PRESSURE_DELAY,
  ACCELERATION_DELAY_PROBABILITY_CAP_BP,
  ACCELERATION_STREAM_FAMILY,
  ACCELERATION_TOTAL_WORK_MULTIPLIER_BP,
  ACCELERATION_WORK_RATE_MULTIPLIER_BP,
  accelerateCapacityUnits,
  acceleratedRemainingWork,
  accelerationDelayEligible,
  accelerationDelayProbabilityBp,
  accelerationExcessPressureBp,
  accelerationPremiumAlreadyApplied,
  accelerationPremiumWork,
  applyAccelerationPremium,
  constructionCapacityPressureBp,
  constructionWorkStatus,
  resolveAccelerationCapacityPressure,
  weightedConstructionDemand,
} from "../src/constructionAcceleration.js";
import { applySetAcceleration } from "../src/commands.js";
import { fundConstructionProject } from "../src/constructionFunding.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const content = productionShipBuildingContent();

const capacity = (perLine: number): Record<string, SafeInt> =>
  Object.fromEntries(LINE_IDS.map((line) => [line, SafeInt(perLine)]));

/** The production ship-building environment, so balance-constant checks stay honest. */
const environment = content.environmentFor("1880-02");
const productionBalance = environment.constructionBalance;

/** A six-package project, one package per production line, 100 work each (600 total). */
function packages(): ConstructionPackage[] {
  return LINE_IDS.map((line, index) => ({
    id: `pkg-${String(index)}`,
    kind: "HULL",
    line,
    totalWork: SafeInt(100),
    doneWork: SafeInt(0),
    dependsOn: [],
  }));
}

interface ProjectOverrides {
  readonly id?: string;
  readonly status?: ConstructionProject["status"];
  readonly projectType?: ConstructionProject["projectType"];
  readonly totalWork?: number;
  readonly completedWork?: number;
  readonly designVersionId?: string;
  readonly withPackages?: boolean;
}

function project(over: ProjectOverrides = {}): ConstructionProject {
  const withPackages = over.withPackages ?? false;
  const pkgList = withPackages ? packages() : undefined;
  const totalWork = over.totalWork ?? (withPackages ? 600 : 200);
  return {
    id: over.id ?? "proj-1",
    type: "ship",
    projectType: over.projectType ?? "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: over.designVersionId ?? "",
    totalWork: SafeInt(totalWork),
    completedWork: SafeInt(over.completedWork ?? 0),
    paidWork: SafeInt(0),
    status: over.status ?? "ACTIVE",
    startedAt: "1880-01",
    ...(pkgList === undefined ? {} : { packages: pkgList }),
  };
}

function design(id = "d1", perLine = 10): CompiledDesignVersion {
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
    constructionPlan: { yardId: "yard_small", packages: [], capacityUnits: capacity(perLine) },
  };
}

function nation(projects: ConstructionProject[], baseResources = 0, treasury = 1_000): NationState {
  return {
    prestige: SafeInt(20),
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(treasury),
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
  treasury = 1_000,
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "acceleration-pressure",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation(projects, baseResources, treasury)]]),
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

const executeMonth = (
  from: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[] = [],
  seed = "seed",
) =>
  new MonthExecutor().execute(from, commands, seed, new DiagnosticCollector(), undefined, {
    shipBuilding: content,
  });

const month = (n: number) => `1880-${String(n).padStart(2, "0")}`;

describe("acceleration arithmetic (SB3-R8)", () => {
  it("moves work by exactly 10_500 bp and the rate by exactly 11_000 bp", () => {
    expect(ACCELERATION_TOTAL_WORK_MULTIPLIER_BP).toBe(10_500);
    expect(ACCELERATION_WORK_RATE_MULTIPLIER_BP).toBe(11_000);
    expect(ACCELERATION_CAPACITY_PRESSURE_WEIGHT_BP).toBe(12_500);
    expect(acceleratedRemainingWork(100)).toBe(105);
    expect(accelerationPremiumWork(100)).toBe(5);
    expect(acceleratedRemainingWork(1)).toBe(2);
    expect(acceleratedRemainingWork(0)).toBe(0);
    expect(accelerateCapacityUnits({ slipway: 10, quay: 25 })).toEqual({ slipway: 11, quay: 27 });
  });

  it("agrees with the forecast's 10% / +5% constants", () => {
    // The forecast applies `accelerationTimeBp: 9000` (10% shorter) and `accelerationCostBp: 500` (5% dearer);
    // the engine's 11_000 rate and 10_500 premium are the reciprocal/forward forms of the same trade (rounding to
    // whole units is the only difference, and the forecast's own table is displacement-rounded too).
    expect(productionBalance.accelerationTimeBp).toBe(9_000);
    expect(environment.costBalance.accelerationCostBp).toBe(500);
    expect(accelerateCapacityUnits({ slipway: 10 }).slipway).toBe(11);
    expect(accelerationPremiumWork(100)).toBe(5);
  });

  it("applies the premium once, never retroactively, and only once per remaining-work segment", () => {
    const start = project({ totalWork: 100, completedWork: 20 });
    const first = applyAccelerationPremium(start);
    expect(first.charged).toBe(true);
    expect(first.premiumWork).toBe(4); // ceil(80 * 1.05) = 84
    expect(Number(first.project.totalWork)).toBe(104);
    expect(Number(first.project.completedWork)).toBe(20);
    expect(accelerationPremiumAlreadyApplied(first.project)).toBe(true);

    const again = applyAccelerationPremium(first.project);
    expect(again.charged).toBe(false);
    expect(Number(again.project.totalWork)).toBe(104);

    // Progressing work starts a new segment, so the next enable prices the new remaining work.
    const progressed = { ...first.project, completedWork: SafeInt(24) };
    const second = applyAccelerationPremium(progressed);
    expect(second.charged).toBe(true);
    expect(second.premiumWork).toBe(4); // ceil(80 * 1.05) = 84, minus 80
    expect(Number(second.project.totalWork)).toBe(108);
  });

  it("distributes the package premium so the project's total is still the sum of its packages", () => {
    const start = project({ withPackages: true }); // 6 x 100 = 600
    const applied = applyAccelerationPremium(start);
    expect(Number(applied.project.totalWork)).toBe(630);
    const packageTotal = applied.project.packages!.reduce((sum, p) => sum + Number(p.totalWork), 0);
    expect(packageTotal).toBe(630);
    expect(applied.project.packages!.every((p) => Number(p.doneWork) === 0)).toBe(true);
  });
});

describe("acceleration capacity pressure arithmetic (SB3-R9, SB3-R10)", () => {
  it("weights accelerated demand by exactly 12_500 bp and computes the pressure", () => {
    expect(weightedConstructionDemand(100, 100)).toBe(225);
    expect(weightedConstructionDemand(100, 0)).toBe(100);
    expect(constructionCapacityPressureBp(9_000, 10_000)).toBe(9_000);
    expect(constructionCapacityPressureBp(18_000, 10_000)).toBe(18_000);
    expect(constructionCapacityPressureBp(1, 0)).toBe(10_000);
  });

  it("treats exactly 9_000 bp as ineligible and bounds probability at 5_000 bp", () => {
    expect(accelerationDelayEligible(9_000)).toBe(false);
    expect(accelerationDelayEligible(9_001)).toBe(true);
    expect(accelerationExcessPressureBp(9_000)).toBe(0);
    expect(accelerationExcessPressureBp(19_000)).toBe(10_000);
    expect(accelerationExcessPressureBp(99_000)).toBe(10_000);
    expect(accelerationDelayProbabilityBp(9_000)).toBe(0);
    expect(accelerationDelayProbabilityBp(14_000)).toBe(2_500);
    expect(accelerationDelayProbabilityBp(19_000)).toBe(5_000);
    expect(accelerationDelayProbabilityBp(1_000_000)).toBe(ACCELERATION_DELAY_PROBABILITY_CAP_BP);
  });

  it("records a keyed decision for every eligible accelerated project and delays only on a successful check", () => {
    const ledger = new RandomLedger();
    const outcome = resolveAccelerationCapacityPressure({
      nationId: "GBR",
      campaignMonth: "1880-02",
      normalDemand: 0,
      acceleratedDemand: 100,
      availableCapacity: 1,
      acceleratedProjects: [project({ id: "a" }), project({ id: "b" })],
      randomEngine: new RandomEngine("pressure-seed"),
      randomLedger: ledger,
    });
    expect(outcome.capacityPressureBp).toBeGreaterThan(9_000);
    expect(outcome.decisions).toHaveLength(2);
    expect(ledger.all).toHaveLength(2);
    for (const decision of outcome.decisions) {
      expect(decision.streamId).toBe(ACCELERATION_STREAM_FAMILY);
      expect(decision.draw).toBeGreaterThanOrEqual(0);
      expect(decision.draw).toBeLessThan(10_000);
    }
    expect(outcome.delayedProjectIds.length).toBe(
      outcome.decisions.filter((d) => d.outcome === "DELAYED").length,
    );
  });
});

describe("applySetAcceleration (SB3-R8)", () => {
  it("enables acceleration once, applies the premium and refuses to charge it twice", () => {
    const collector = new DiagnosticCollector();
    const from = snapshot(
      [project({ totalWork: 600, withPackages: true, designVersionId: "d1" })],
      new Map([["d1", design()]]),
    );
    const enabled = applySetAcceleration(
      from,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      collector,
    );
    const accelerated = enabled.nations.get("GBR")!.constructionProjects[0]!;
    expect(accelerated.status).toBe("ACCELERATED");
    expect(Number(accelerated.totalWork)).toBe(630);

    const disabled = applySetAcceleration(
      enabled,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: false },
      collector,
    );
    expect(disabled.nations.get("GBR")!.constructionProjects[0]!.status).toBe("ACTIVE");
    const reenabled = applySetAcceleration(
      disabled,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      collector,
    );
    expect(Number(reenabled.nations.get("GBR")!.constructionProjects[0]!.totalWork)).toBe(630);
  });

  it("refuses a rebuild project with ACCELERATION_NOT_ALLOWED and leaves the snapshot untouched", () => {
    const from = snapshot([project({ projectType: "REBUILD" })]);
    const collector = new DiagnosticCollector();
    const next = applySetAcceleration(
      from,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      collector,
    );
    expect(next).toBe(from);
    expect(collector.errors.map((e) => e.code)).toContain("ACCELERATION_NOT_ALLOWED");
  });

  it("has no fixed N-ship cap: many projects can be accelerated without a count-based rejection", () => {
    const projects = Array.from({ length: 24 }, (_, i) => project({ id: `proj-${String(i)}` }));
    let current = snapshot(projects);
    const collector = new DiagnosticCollector();
    for (const p of projects)
      current = applySetAcceleration(
        current,
        { type: "SetAcceleration", nationId: "GBR", projectId: p.id, accelerated: true },
        collector,
      );
    expect(
      current.nations.get("GBR")!.constructionProjects.every((p) => p.status === "ACCELERATED"),
    ).toBe(true);
    expect(collector.errors.map((e) => e.code)).not.toContain("ACCELERATION_NOT_ALLOWED");
  });
});

describe("a paid accelerated month uses the 11_000 bp capacity rate (SB3-R8)", () => {
  it("the accelerated project applies 10% more work than the normal one at the same capacity", () => {
    const normal = fundConstructionProject(
      project({ withPackages: true, designVersionId: "d1" }),
      capacity(10),
      1_000_000,
      "1880-02",
    );
    const accelerated = fundConstructionProject(
      transitionConstructionProject(
        project({ withPackages: true, designVersionId: "d1" }),
        "ACCELERATED",
      ),
      capacity(10),
      1_000_000,
      "1880-02",
    );
    expect(normal.applied).toBe(60);
    expect(accelerated.applied).toBe(66);
    expect(accelerated.project.status).toBe("ACCELERATED");
  });

  it("completes while accelerated, applying the premium exactly once through the funding loop", () => {
    let p = transitionConstructionProject(project({ withPackages: true }), "ACCELERATED");
    p = applyAccelerationPremium(p).project;
    expect(Number(p.totalWork)).toBe(630);
    for (let m = 1; m <= 40 && Number(p.completedWork) < Number(p.totalWork); m++)
      p = fundConstructionProject(p, capacity(1_000), 1_000_000, month(((m - 1) % 12) + 1)).project;
    expect(Number(p.completedWork)).toBe(630);
    expect(p.status).toBe("ACCELERATED");
  });
});

describe("annual/monthly integration of acceleration pressure (SB3-R9)", () => {
  /** A seed whose keyed draw for the project triggers a delay at the maximum probability. */
  function seedThatDelays(base: CampaignSnapshot, projectId: string): string {
    const nationId = "GBR";
    const campaignMonth = campaignMonthId(
      base["startYear"],
      base["startMonth"],
      base["turnNumber"] as number,
    );
    const acceleratedProjects = base.nations
      .get(nationId)!
      .constructionProjects.filter((p) => p.status === "ACCELERATED");
    for (let i = 0; i < 400; i++) {
      const seed = `accel-seed-${String(i)}`;
      const ledger = new RandomLedger();
      const outcome = resolveAccelerationCapacityPressure({
        nationId,
        campaignMonth,
        normalDemand: 0,
        acceleratedDemand: 60,
        availableCapacity: 1,
        acceleratedProjects,
        randomEngine: new RandomEngine(seed),
        randomLedger: ledger,
      });
      if (outcome.delayedProjectIds.includes(projectId)) return seed;
    }
    throw new Error("no seed produced a delay in 400 tries");
  }

  const pressureSnapshot = () =>
    snapshot(
      [
        // The premium has already been charged (as `SetAcceleration` would have), so a pressure delay must preserve
        // it: totalWork stays 630 after the delayed month.
        transitionConstructionProject(
          applyAccelerationPremium(
            project({
              id: "proj-1",
              status: "ACTIVE",
              withPackages: true,
              designVersionId: "d1",
            }),
          ).project,
          "ACCELERATED",
        ),
      ],
      new Map([["d1", design()]]),
      1_200, // construction cap 1 => pressure far above the 9_000 bp threshold
    );

  it("delays the accelerated project for one month with a random-decision record and zero work/charge", () => {
    const from = pressureSnapshot();
    const seed = seedThatDelays(from, "proj-1");
    const result = executeMonth(from, [], seed);
    const p = result.finalSnapshot.nations.get("GBR")!.constructionProjects[0]!;
    expect(p.status).toBe("DELAYED");
    expect(Number(p.completedWork)).toBe(0);
    expect(Number(p.paidWork)).toBe(0);
    // The one-time premium is preserved across the delay (totalWork stays 630).
    expect(Number(p.totalWork)).toBe(630);
    // Zero ordinary charge: no appropriation posting and no applied work this month.
    expect(result.financialLedger.all.some((e) => e.categoryId === "APPROPRIATION")).toBe(false);
    const delay = result.eventLedger.all.find((e) => e.eventType === "ConstructionDelayed");
    expect(delay?.body).toMatchObject({
      projectId: "proj-1",
      reason: ACCELERATION_CAPACITY_PRESSURE_DELAY,
    });
    const decision = result.randomLedger.all.find((d) => d.streamId === ACCELERATION_STREAM_FAMILY);
    expect(decision?.outcome).toBe("DELAYED");
    expect(decision?.reasonCode).toBe(ACCELERATION_CAPACITY_PRESSURE_DELAY);
  });

  it("resumes the delayed project to ACTIVE the following month", () => {
    const from = pressureSnapshot();
    const seed = seedThatDelays(from, "proj-1");
    const first = executeMonth(from, [], seed);
    const advanced: CampaignSnapshot = {
      ...first.finalSnapshot,
      turnNumber: SafeInt.add(first.finalSnapshot.turnNumber, SafeInt(1)),
    };
    const second = executeMonth(advanced, [], seed);
    const p = second.finalSnapshot.nations.get("GBR")!.constructionProjects[0]!;
    expect(p.status).toBe("ACTIVE");
  });

  it("same seed produces identical delay decisions and snapshot/random-ledger hashes", () => {
    const from = pressureSnapshot();
    const seed = seedThatDelays(from, "proj-1");
    const a = executeMonth(from, [], seed);
    const b = executeMonth(from, [], seed);
    expect(sha256Hex(canonicalSerialize(a.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.finalSnapshot)),
    );
    expect(a.randomLedger.hash()).toBe(b.randomLedger.hash());
    expect(a.randomLedger.toJSON()).toBe(b.randomLedger.toJSON());
    expect(a.randomLedger.all.length).toBeGreaterThan(0);
  });

  it("draws no randomness and changes nothing when no project is accelerated", () => {
    const from = snapshot(
      [project({ id: "proj-1", withPackages: true, designVersionId: "d1" })],
      new Map([["d1", design()]]),
      120_000,
    );
    const result = executeMonth(from, [], "no-acceleration-seed");
    expect(result.randomLedger.all).toHaveLength(0);
  });
});

describe("SetAcceleration command definition (SB3-R8)", () => {
  it("is a valid, registered construction command model", () => {
    expect(() => assertValidDefinitionOrThrow(SET_ACCELERATION_COMMAND_DEFINITION)).not.toThrow();
    expect(SET_ACCELERATION_COMMAND_DEFINITION.commandTypeId).toBe(
      SET_ACCELERATION_COMMAND_TYPE_ID,
    );
    expect(SET_ACCELERATION_COMMAND_DEFINITION.targetAggregateType).toBe("construction");
    expect(SET_ACCELERATION_COMMAND_DEFINITION.reservationPolicyId).toBe("none");
  });
});

describe("constructionWorkStatus", () => {
  it("keeps an accelerated project accelerated and makes anything else active", () => {
    expect(constructionWorkStatus("ACCELERATED")).toBe("ACCELERATED");
    expect(constructionWorkStatus("ACTIVE")).toBe("ACTIVE");
    expect(constructionWorkStatus("PLANNED")).toBe("ACTIVE");
  });
});
