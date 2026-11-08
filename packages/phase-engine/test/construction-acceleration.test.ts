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
import { accelerationTermsOf, LINE_IDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { assertValidDefinitionOrThrow } from "@bluewave/commands";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { MonthExecutor } from "../src/index.js";
import {
  SET_ACCELERATION_COMMAND_DEFINITION,
  SET_ACCELERATION_COMMAND_TYPE_ID,
} from "../src/commandDefinitions.js";
import {
  ACCELERATION_CAPACITY_PRESSURE_DELAY,
  ACCELERATION_STREAM_FAMILY,
  accelerateCapacityUnits,
  acceleratedRemainingWork,
  accelerationDelayEligible,
  accelerationDelayProbabilityBp,
  accelerationDemandOf,
  accelerationExcessPressureBp,
  accelerationPoolUnitsOf,
  accelerationPressureOf,
  accelerationStartedProject,
  nationAccelerationPressureOf,
  accelerationPremiumAlreadyApplied,
  accelerationPremiumWork,
  applyAccelerationPremium,
  constructionCapacityPressureBp,
  constructionWorkStatus,
  resolveAccelerationCapacityPressure,
  weightedConstructionDemand,
} from "../src/constructionAcceleration.js";
import { applyHaltConstruction, applySetAcceleration } from "../src/commands.js";
import { constructionProjectQueueWithReadouts } from "../src/constructionReadout.js";
import { constructionSteeringPreviews } from "../src/constructionSteeringPreview.js";
import { fundConstructionProject } from "../src/constructionFunding.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const content = productionShipBuildingContent();

const capacity = (perLine: number): Record<string, SafeInt> =>
  Object.fromEntries(LINE_IDS.map((line) => [line, SafeInt(perLine)]));

const environment = content.environmentFor("1880-02");
const productionBalance = environment.constructionBalance;
const terms = accelerationTermsOf(productionBalance, environment.costBalance);

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
  it("moves work by the content premium and the rate by the work multiple over the time factor", () => {
    expect(terms.workMultiplierBp).toBe(10_500);
    expect(terms.timeBp).toBe(9_000);
    expect(terms.pressureWeightBp).toBe(12_500);
    expect(acceleratedRemainingWork(100, terms)).toBe(105);
    expect(accelerationPremiumWork(100, terms)).toBe(5);
    expect(acceleratedRemainingWork(1, terms)).toBe(2);
    expect(acceleratedRemainingWork(0, terms)).toBe(0);
    expect(accelerateCapacityUnits({ slipway: 10, quay: 25 }, terms)).toEqual({
      slipway: 11,
      quay: 29,
    });
  });

  it("derives the work rate so the net build time is the content time factor", () => {
    expect(productionBalance.accelerationTimeBp).toBe(9_000);
    expect(environment.costBalance.accelerationCostBp).toBe(500);
    expect(accelerateCapacityUnits({ slipway: 900 }, terms).slipway).toBe(1_050);
    expect(accelerationPremiumWork(100, terms)).toBe(5);
    expect(accelerationPremiumWork(100, terms)).toBe(5);
  });

  it("applies the premium once, never retroactively, and only once per remaining-work segment", () => {
    const start = project({ totalWork: 100, completedWork: 20 });
    const first = applyAccelerationPremium(start, terms);
    expect(first.charged).toBe(true);
    expect(first.premiumWork).toBe(4);
    expect(Number(first.project.totalWork)).toBe(104);
    expect(Number(first.project.completedWork)).toBe(20);
    expect(accelerationPremiumAlreadyApplied(first.project)).toBe(true);

    const again = applyAccelerationPremium(first.project, terms);
    expect(again.charged).toBe(false);
    expect(Number(again.project.totalWork)).toBe(104);

    const progressed = { ...first.project, completedWork: SafeInt(24) };
    const second = applyAccelerationPremium(progressed, terms);
    expect(second.charged).toBe(true);
    expect(second.premiumWork).toBe(4);
    expect(Number(second.project.totalWork)).toBe(108);
  });

  it("distributes the package premium so the project's total is still the sum of its packages", () => {
    const start = project({ withPackages: true });
    const applied = applyAccelerationPremium(start, terms);
    expect(Number(applied.project.totalWork)).toBe(630);
    const packageTotal = applied.project.packages!.reduce((sum, p) => sum + Number(p.totalWork), 0);
    expect(packageTotal).toBe(630);
    expect(applied.project.packages!.every((p) => Number(p.doneWork) === 0)).toBe(true);
  });
});

describe("acceleration capacity pressure arithmetic (SB3-R9, SB3-R10)", () => {
  it("weights accelerated demand by exactly 12_500 bp and computes the pressure", () => {
    expect(weightedConstructionDemand(100, 100, terms)).toBe(225);
    expect(weightedConstructionDemand(100, 0, terms)).toBe(100);
    expect(constructionCapacityPressureBp(9_000, 10_000)).toBe(9_000);
    expect(constructionCapacityPressureBp(18_000, 10_000)).toBe(18_000);
    expect(constructionCapacityPressureBp(1, 0)).toBe(10_000);
  });

  it("treats exactly 9_000 bp as ineligible and bounds probability at 5_000 bp", () => {
    expect(accelerationDelayEligible(9_000, terms)).toBe(false);
    expect(accelerationDelayEligible(9_001, terms)).toBe(true);
    expect(accelerationExcessPressureBp(9_000, terms)).toBe(0);
    expect(accelerationExcessPressureBp(19_000, terms)).toBe(10_000);
    expect(accelerationExcessPressureBp(99_000, terms)).toBe(10_000);
    expect(accelerationDelayProbabilityBp(9_000, terms)).toBe(0);
    expect(accelerationDelayProbabilityBp(14_000, terms)).toBe(2_500);
    expect(accelerationDelayProbabilityBp(19_000, terms)).toBe(5_000);
    expect(accelerationDelayProbabilityBp(1_000_000, terms)).toBe(terms.delayProbabilityCapBp);
  });

  it("records a keyed decision for every eligible accelerated project and delays only on a successful check", () => {
    const ledger = new RandomLedger();
    const outcome = resolveAccelerationCapacityPressure({
      nationId: "GBR",
      campaignMonth: "1880-02",
      normalDemand: 0,
      acceleratedDemand: 100,
      availableCapacity: 1,
      terms,
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

describe("accelerationDemandOf and accelerationPressureOf", () => {
  const none = () => undefined;

  it("splits live demand into normal and accelerated, skipping halted, delayed and finished projects", () => {
    const demand = accelerationDemandOf(
      [
        project({ id: "a", status: "ACTIVE", totalWork: 200 }),
        project({ id: "b", status: "ACCELERATED", totalWork: 200, completedWork: 50 }),
        project({ id: "c", status: "HALTED" }),
        project({ id: "d", status: "DELAYED" }),
        project({ id: "e", status: "COMPLETED" }),
      ],
      none,
      "1880-02",
      terms,
    );
    expect(demand).toEqual({ normalDemand: 200, acceleratedDemand: 150 });
  });

  it("reads pressure against the supplied pool", () => {
    const pressure = accelerationPressureOf(
      { normalDemand: 200, acceleratedDemand: 150 },
      1_000,
      terms,
    );
    expect(pressure.weightedDemand).toBe(weightedConstructionDemand(200, 150, terms));
    expect(pressure.capacityPressureBp).toBe(3_870);
    expect(pressure.delayProbabilityBp).toBe(0);
    expect(
      accelerationPressureOf({ normalDemand: 0, acceleratedDemand: 0 }, 1_000, terms),
    ).toMatchObject({ capacityPressureBp: 0, delayProbabilityBp: 0 });
  });
});

describe("the national acceleration pool", () => {
  const pacedProject = (
    id: string,
    status: ConstructionProject["status"],
  ): ConstructionProject => ({
    ...project({ id, status, withPackages: true, designVersionId: "d1" }),
    buildMonths: 12,
  });
  const capacityOfPaced = () => capacity(50);
  const accelerated = (count: number): ConstructionProject[] =>
    Array.from({ length: count }, (_, i) => pacedProject(`a${String(i)}`, "ACCELERATED"));

  it("is the content multiple of the largest per-project line rate, ignoring finished projects", () => {
    const rates = (project: ConstructionProject): Record<string, number> =>
      project["id"] === "big" ? { slipway: 80, quay: 20 } : { slipway: 50 };
    expect(
      accelerationPoolUnitsOf(
        [
          pacedProject("big", "ACTIVE"),
          pacedProject("small", "ACCELERATED"),
          pacedProject("done", "COMPLETED"),
        ],
        rates,
        terms,
      ),
    ).toBe((80 * productionBalance.accelerationPoolMultipleBp) / 10_000);
    expect(accelerationPoolUnitsOf([pacedProject("done", "COMPLETED")], rates, terms)).toBe(0);
  });

  it("never delays a lone accelerated ship", () => {
    const pressure = nationAccelerationPressureOf(
      accelerated(1),
      capacityOfPaced,
      "1880-02",
      terms,
    );
    expect(pressure.poolUnits).toBeGreaterThan(0);
    expect(pressure.capacityPressureBp).toBeLessThanOrEqual(terms.delayThresholdBp);
    expect(pressure.delayProbabilityBp).toBe(0);
  });

  it("delays accelerated ships once enough of them are accelerated together", () => {
    const lone = nationAccelerationPressureOf(accelerated(1), capacityOfPaced, "1880-02", terms);
    const several = nationAccelerationPressureOf(accelerated(3), capacityOfPaced, "1880-02", terms);
    const many = nationAccelerationPressureOf(accelerated(8), capacityOfPaced, "1880-02", terms);
    expect(several.delayProbabilityBp).toBeGreaterThan(0);
    expect(many.delayProbabilityBp).toBeGreaterThanOrEqual(several.delayProbabilityBp);
    expect(many.delayProbabilityBp).toBe(terms.delayProbabilityCapBp);
    expect(lone.delayProbabilityBp).toBeLessThan(several.delayProbabilityBp);
  });

  it("weighs accelerated demand above the same ships at the normal rate", () => {
    const normal = Array.from({ length: 3 }, (_, i) => pacedProject(`n${String(i)}`, "ACTIVE"));
    const pressure = nationAccelerationPressureOf(normal, capacityOfPaced, "1880-02", terms);
    const fast = nationAccelerationPressureOf(accelerated(3), capacityOfPaced, "1880-02", terms);
    expect(pressure.capacityPressureBp).toBeLessThan(fast.capacityPressureBp);
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
      terms,
      "1880-02",
    );
    const accelerated = enabled.nations.get("GBR")!.constructionProjects[0]!;
    expect(accelerated.status).toBe("ACCELERATED");
    expect(Number(accelerated.totalWork)).toBe(630);

    const disabled = applySetAcceleration(
      enabled,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: false },
      collector,
      terms,
      "1880-02",
    );
    expect(disabled.nations.get("GBR")!.constructionProjects[0]!.status).toBe("ACTIVE");
    const reenabled = applySetAcceleration(
      disabled,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      collector,
      terms,
      "1880-02",
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
      terms,
      "1880-02",
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
        terms,
        "1880-02",
      );
    expect(
      current.nations.get("GBR")!.constructionProjects.every((p) => p.status === "ACCELERATED"),
    ).toBe(true);
    expect(collector.errors.map((e) => e.code)).not.toContain("ACCELERATION_NOT_ALLOWED");
  });
});

describe("a paid accelerated month uses the content work rate (SB3-R8)", () => {
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
      terms,
    );
    expect(normal.applied).toBe(60);
    expect(accelerated.applied).toBe(66);
    expect(accelerated.project.status).toBe("ACCELERATED");
  });

  it("completes while accelerated, applying the premium exactly once through the funding loop", () => {
    let p = transitionConstructionProject(project({ withPackages: true }), "ACCELERATED");
    p = applyAccelerationPremium(p, terms).project;
    expect(Number(p.totalWork)).toBe(630);
    for (let m = 1; m <= 40 && Number(p.completedWork) < Number(p.totalWork); m++)
      p = fundConstructionProject(
        p,
        capacity(1_000),
        1_000_000,
        month(((m - 1) % 12) + 1),
        terms,
      ).project;
    expect(Number(p.completedWork)).toBe(630);
    expect(p.status).toBe("ACCELERATED");
  });
});

describe("annual/monthly integration of acceleration pressure (SB3-R9)", () => {
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
    const { demand, poolUnits } = nationAccelerationPressureOf(
      acceleratedProjects,
      (p) => base.designs.get(p.designVersionId)?.constructionPlan?.capacityUnits,
      campaignMonth,
      terms,
    );
    for (let i = 0; i < 400; i++) {
      const seed = `accel-seed-${String(i)}`;
      const ledger = new RandomLedger();
      const outcome = resolveAccelerationCapacityPressure({
        nationId,
        campaignMonth,
        normalDemand: demand.normalDemand,
        acceleratedDemand: demand.acceleratedDemand,
        availableCapacity: poolUnits,
        terms,
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
      Array.from({ length: 8 }, (_, i) =>
        transitionConstructionProject(
          accelerationStartedProject(
            {
              ...project({
                id: `proj-${String(i + 1)}`,
                status: "ACTIVE",
                withPackages: true,
                designVersionId: "d1",
              }),
              buildMonths: 12,
            },
            terms,
            "1880-01",
          ),
          "ACCELERATED",
        ),
      ),
      new Map([["d1", design("d1", 50)]]),
      6_000,
    );

  it("delays the accelerated project for one month with a random-decision record and zero work/charge", () => {
    const from = pressureSnapshot();
    const seed = seedThatDelays(from, "proj-1");
    const result = executeMonth(from, [], seed);
    const p = result.finalSnapshot.nations.get("GBR")!.constructionProjects[0]!;
    expect(p.status).toBe("DELAYED");
    expect(Number(p.completedWork)).toBe(0);
    expect(Number(p.paidWork)).toBe(0);
    expect(Number(p.totalWork)).toBe(630);
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

describe("accelerating a paced project actually shortens the build (issue 574)", () => {
  const BUILD_MONTHS = 10;
  const TOTAL_WORK = 600;

  const pacedSnapshot = (): CampaignSnapshot =>
    snapshot(
      [
        {
          ...project({ withPackages: true, designVersionId: "d1" }),
          buildMonths: BUILD_MONTHS,
          startedAt: "1880-02",
        },
      ],
      new Map([["d1", design("d1", TOTAL_WORK / BUILD_MONTHS)]]),
      0,
      1_000_000,
    );

  interface Finish {
    readonly months: number;
    readonly paid: number;
    readonly statuses: readonly string[];
    readonly randomDecisions: number;
  }

  function buildToCompletion(start: CampaignSnapshot): Finish {
    let current = start;
    const statuses: string[] = [];
    let randomDecisions = 0;
    for (let m = 1; m <= 24; m++) {
      const result = executeMonth(current, [], "lone-seed");
      const drawn = result.randomLedger.all.filter(
        (d) => d.streamId === ACCELERATION_STREAM_FAMILY,
      );
      randomDecisions += drawn.length;
      current = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
      };
      const built = current.nations.get("GBR")!.constructionProjects[0]!;
      statuses.push(built.status);
      if (Number(built.completedWork) >= Number(built.totalWork))
        return { months: m, paid: Number(built.paidWork), statuses, randomDecisions };
    }
    throw new Error("project never completed");
  }

  const accelerate = (from: CampaignSnapshot): CampaignSnapshot =>
    applySetAcceleration(
      from,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      new DiagnosticCollector(),
      terms,
      "1880-02",
    );

  it("completes earlier by the content time factor and pays exactly the premium more", () => {
    const normal = buildToCompletion(pacedSnapshot());
    const fast = buildToCompletion(accelerate(pacedSnapshot()));
    const expectedMonths = (normal.months * terms.timeBp) / 10_000;
    expect(normal.months).toBe(BUILD_MONTHS);
    expect(fast.months).toBeLessThan(normal.months);
    expect(Math.abs(fast.months - expectedMonths)).toBeLessThanOrEqual(1);
    expect(normal.paid).toBe(TOTAL_WORK);
    expect(fast.paid - normal.paid).toBe(accelerationPremiumWork(TOTAL_WORK, terms));
  });

  it("stays accelerated every month and draws no delay for a lone ship", () => {
    const fast = buildToCompletion(accelerate(pacedSnapshot()));
    expect(fast.randomDecisions).toBe(0);
    expect(fast.statuses.slice(0, -1).every((status) => status === "ACCELERATED")).toBe(true);
  });

  it("loads and plays on a save that predates the acceleration anchors, at the normal pace", () => {
    const accelerated = accelerate(pacedSnapshot());
    const nationState = accelerated.nations.get("GBR")!;
    const stripped = nationState.constructionProjects.map((entry) => {
      const { acceleratedFromMonth, acceleratedFromWork, ...legacy } = entry;
      void acceleratedFromMonth;
      void acceleratedFromWork;
      return legacy;
    });
    expect(stripped[0]).not.toHaveProperty("acceleratedFromMonth");
    const legacySnapshot: CampaignSnapshot = {
      ...accelerated,
      nations: new Map([["GBR", { ...nationState, constructionProjects: stripped }]]),
    };
    const finish = buildToCompletion(legacySnapshot);
    expect(finish.months).toBe(BUILD_MONTHS);
    expect(finish.statuses.slice(0, -1).every((status) => status === "ACCELERATED")).toBe(true);
    expect(finish.randomDecisions).toBe(0);
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

describe("the steering preview matches the month run (issue 574)", () => {
  const BUILD_MONTHS = 10;
  const TOTAL_WORK = 600;
  const BASIS = 10_000;

  const pacedSnapshot = (treasury = 1_000_000): CampaignSnapshot =>
    snapshot(
      [
        {
          ...project({ withPackages: true, designVersionId: "d1" }),
          buildMonths: BUILD_MONTHS,
          startedAt: "1880-02",
        },
      ],
      new Map([["d1", design("d1", TOTAL_WORK / BUILD_MONTHS)]]),
      0,
      treasury,
    );

  const previewOf = (from: CampaignSnapshot) =>
    constructionSteeringPreviews(from, "GBR", content, { acceleration: terms }).get("proj-1")!;

  function replay(start: CampaignSnapshot): { months: number; paid: number; decisions: number } {
    let current = start;
    let decisions = 0;
    for (let m = 1; m <= 24; m++) {
      const result = executeMonth(current, [], "preview-seed");
      decisions += result.randomLedger.all.filter(
        (d) => d.streamId === ACCELERATION_STREAM_FAMILY,
      ).length;
      current = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
      };
      const built = current.nations.get("GBR")!.constructionProjects[0]!;
      if (Number(built.completedWork) >= Number(built.totalWork))
        return { months: m, paid: Number(built.paidWork), decisions };
    }
    throw new Error("project never completed");
  }

  const accelerated = (from: CampaignSnapshot): CampaignSnapshot =>
    applySetAcceleration(
      from,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      new DiagnosticCollector(),
      terms,
      "1880-02",
    );

  it("states the months, months saved and premium that a month-by-month replay then produces", () => {
    const preview = previewOf(pacedSnapshot()).accelerate!;
    const normal = replay(pacedSnapshot());
    const fast = replay(accelerated(pacedSnapshot()));
    expect(preview.monthsSaved).toBeGreaterThan(0);
    expect(preview.monthsNow).toBe(normal.months);
    expect(preview.monthsAccelerated).toBe(fast.months);
    expect(preview.monthsSaved).toBe(normal.months - fast.months);
    expect(preview.premiumUnits).toBe(fast.paid - normal.paid);
    expect(preview.premiumExplanation.result).toBe(preview.premiumUnits);
    expect(preview.monthsExplanation.result).toBe(preview.monthsSaved);
  });

  it("states no delay risk for a lone ship, and the replay draws nothing", () => {
    const preview = previewOf(pacedSnapshot()).accelerate!;
    expect(preview.delayRisk).toBe("NONE");
    expect(preview.delayChanceBp).toBe(0);
    expect(replay(accelerated(pacedSnapshot())).decisions).toBe(0);
  });

  it("says funds, not capacity, are the limiter when the treasury cannot pay the monthly work", () => {
    expect(previewOf(pacedSnapshot()).accelerate!.fundsLimited).toBe(false);
    expect(previewOf(pacedSnapshot(1)).accelerate!.fundsLimited).toBe(true);
  });

  it("gives the carrying cost and resume behaviour the halted project then shows", () => {
    const halt = previewOf(pacedSnapshot()).halt!;
    const halted = applyHaltConstruction(
      pacedSnapshot(),
      { type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" },
      new DiagnosticCollector(),
    );
    const readout = constructionProjectQueueWithReadouts(halted, "GBR", content, "1880-02")[0]!
      .readout!;
    expect(halt.carryingCostUnits).toBe(readout.haltedCarryingCostUnits);
    expect(halt.resumeStatus).toBe("ACTIVE");
    expect(halt.losesAcceleration).toBe(false);
    expect(previewOf(accelerated(pacedSnapshot())).halt!.losesAcceleration).toBe(true);
  });

  it("lets each tree reproduce its figure from its own inputs with the engine's rounding", () => {
    const preview = previewOf(pacedSnapshot());
    const premium = preview.accelerate!.premiumExplanation;
    const remaining = Number(premium.inputs["remainingWork"]);
    const rate = Number(premium.inputs["premiumRateBp"]);
    expect(premium.inputs["rounding"]).toBe("ceil");
    expect(Math.ceil((remaining * (BASIS + rate)) / BASIS) - remaining).toBe(premium.result);
    expect(premium.intermediate["acceleratedRemainingWork"]).toBe(
      remaining + Number(premium.result),
    );

    const months = preview.accelerate!.monthsExplanation;
    expect(Number(months.inputs["monthsNow"]) - Number(months.inputs["monthsAccelerated"])).toBe(
      months.result,
    );

    const carrying = preview.halt!.carryingExplanation;
    const micro = Math.floor(
      (Number(carrying.inputs["mothballedMaintenancePerMonthMicro"]) *
        Number(carrying.inputs["preservationCostBp"])) /
        BASIS,
    );
    expect(carrying.intermediate["preservationCostPerMonthMicro"]).toBe(micro);
    expect(Math.max(1, Math.ceil(micro / Number(carrying.inputs["treasuryUnitMicro"])))).toBe(
      carrying.result,
    );
    expect(carrying.children).toHaveLength(3);
  });

  it("lets the delay tree reproduce the chance from the pressure it was priced at", () => {
    const delay = previewOf(pacedSnapshot()).accelerate!.delayExplanation;
    const pressure = Number(delay.inputs["capacityPressureBp"]);
    const threshold = Number(delay.inputs["delayThresholdBp"]);
    const cap = Number(delay.inputs["delayProbabilityCapBp"]);
    const excess = Math.max(0, Math.min(BASIS, pressure - threshold));
    expect(delay.intermediate["excessPressureBp"]).toBe(excess);
    expect(Math.floor((excess * cap) / BASIS)).toBe(delay.result);
    expect(delay.inputs["poolUnits"]).toBeGreaterThan(0);
  });

  it("offers no acceleration preview for a project that is already accelerated", () => {
    expect(previewOf(accelerated(pacedSnapshot())).accelerate).toBeNull();
  });
});

describe("accelerating an unpaced packaged ship never lengthens it (issue 574)", () => {
  const INFLEXIBLE_PACKAGES: ConstructionPackage[] = [
    {
      id: "hull",
      kind: "HULL",
      line: "slipway",
      totalWork: SafeInt(74),
      doneWork: SafeInt(60),
      dependsOn: [],
    },
    {
      id: "launch",
      kind: "LAUNCH",
      line: "slipway",
      totalWork: SafeInt(2),
      doneWork: SafeInt(0),
      dependsOn: ["hull"],
    },
    {
      id: "fit_out",
      kind: "FIT_OUT",
      line: "quay",
      totalWork: SafeInt(19),
      doneWork: SafeInt(0),
      dependsOn: ["launch"],
    },
    {
      id: "trials",
      kind: "TRIALS",
      line: "trials",
      totalWork: SafeInt(4),
      doneWork: SafeInt(0),
      dependsOn: ["fit_out"],
    },
    {
      id: "acceptance",
      kind: "ACCEPTANCE",
      line: "trials",
      totalWork: SafeInt(1),
      doneWork: SafeInt(0),
      dependsOn: ["trials"],
    },
  ];

  const inflexibleSnapshot = (): CampaignSnapshot =>
    snapshot(
      [
        {
          ...project({ withPackages: true, designVersionId: "d1" }),
          id: "proj-1",
          totalWork: SafeInt(100),
          completedWork: SafeInt(60),
          startedAt: "1880-01",
          packages: INFLEXIBLE_PACKAGES,
          capacityUnits: { slipway: SafeInt(2), quay: SafeInt(2), trials: SafeInt(2) },
          buildTimeMultiplierBp: SafeInt(9_300),
        },
      ],
      new Map([["d1", design("d1", 2)]]),
      0,
      1_000_000,
    );

  const accelerate = (from: CampaignSnapshot): CampaignSnapshot =>
    applySetAcceleration(
      from,
      { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
      new DiagnosticCollector(),
      terms,
      "1880-01",
    );

  function monthsToFinish(start: CampaignSnapshot): { months: number; paid: number } {
    let current = start;
    for (let m = 1; m <= 60; m++) {
      const result = executeMonth(current, [], "inflexible-seed");
      current = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
      };
      const built = current.nations.get("GBR")!.constructionProjects[0]!;
      if (Number(built.completedWork) >= Number(built.totalWork))
        return { months: m, paid: Number(built.paidWork) };
    }
    throw new Error("project never completed");
  }

  const readoutMonths = (from: CampaignSnapshot): number =>
    constructionProjectQueueWithReadouts(from, "GBR", content, "1880-01")[0]!.readout!
      .remainingMonths;

  it("finishes sooner, by about the content time factor, and pays exactly the premium more", () => {
    const normal = monthsToFinish(inflexibleSnapshot());
    const fast = monthsToFinish(accelerate(inflexibleSnapshot()));
    expect(normal.months).toBe(21);
    expect(fast.months).toBe(20);
    expect(fast.months).toBeLessThan(normal.months);
    expect(
      Math.abs(fast.months - Math.ceil((normal.months * terms.timeBp) / 10_000)),
    ).toBeLessThanOrEqual(1);
    expect(fast.paid - normal.paid).toBe(2);
  });

  const monthIdAt = (offset: number): string =>
    `${String(1880 + Math.floor(offset / 12))}-${String((offset % 12) + 1).padStart(2, "0")}`;

  function fundedMonths(start: ConstructionProject, units: number, accelerated: boolean): number {
    const lineUnits = Object.fromEntries(
      ["slipway", "quay", "trials"].map((line) => [line, units]),
    );
    let current = start;
    if (accelerated) {
      const snap = applySetAcceleration(
        snapshot([start]),
        { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
        new DiagnosticCollector(),
        terms,
        "1880-01",
      );
      current = snap.nations.get("GBR")!.constructionProjects[0]!;
    }
    for (let offset = 0; offset < 400; offset++) {
      current = fundConstructionProject(
        current,
        lineUnits,
        1_000_000,
        monthIdAt(offset),
        terms,
      ).project;
      if (Number(current.completedWork) >= Number(current.totalWork)) return offset + 1;
    }
    throw new Error("project never completed");
  }

  it("never takes longer accelerated than normal at any yard rate, progress or build-time scale", () => {
    const lengthened: string[] = [];
    for (const units of [1, 2, 3, 4, 5, 7, 9, 12, 20]) {
      for (const hullDone of [0, 20, 45, 60, 74]) {
        for (const scale of [8_000, 9_300, 10_000]) {
          const packages = INFLEXIBLE_PACKAGES.map((entry) =>
            entry.id === "hull" ? { ...entry, doneWork: SafeInt(hullDone) } : entry,
          );
          const start: ConstructionProject = {
            ...inflexibleSnapshot().nations.get("GBR")!.constructionProjects[0]!,
            completedWork: SafeInt(hullDone),
            packages,
            buildTimeMultiplierBp: SafeInt(scale),
          };
          const normal = fundedMonths(start, units, false);
          const fast = fundedMonths(start, units, true);
          if (fast > normal)
            lengthened.push(
              `units=${String(units)} hullDone=${String(hullDone)} scale=${String(scale)}: ${String(normal)} -> ${String(fast)}`,
            );
        }
      }
    }
    expect(lengthened).toEqual([]);
  });

  it("reads the same months from the engine readout as the month run produces", () => {
    const normalStart = inflexibleSnapshot();
    const fastStart = accelerate(inflexibleSnapshot());
    expect(readoutMonths(normalStart)).toBe(monthsToFinish(normalStart).months);
    expect(readoutMonths(fastStart)).toBe(monthsToFinish(fastStart).months);
    expect(readoutMonths(fastStart)).toBeLessThan(readoutMonths(normalStart));
  });
});
