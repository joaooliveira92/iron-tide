import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
  ForeignConstructionContract,
  NationState,
} from "@bluewave/campaign";
import { buildConstructionProjectQueue } from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { LINE_IDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { preservationCostUnits } from "../src/economyPhases.js";
import {
  constructionProjectQueueWithReadouts,
  constructionProjectReadout,
} from "../src/constructionReadout.js";
import { buildForeignConstructionContract } from "../src/foreignConstruction.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });

interface ProjectOverrides {
  readonly id?: string;
  readonly status?: ConstructionProject["status"];
  readonly totalWork?: number;
  readonly completedWork?: number;
  readonly designVersionId?: string;
  readonly holdUntilMonth?: string;
  readonly foreignContractId?: string;
}

function project(over: ProjectOverrides = {}): ConstructionProject {
  return {
    id: over.id ?? "proj-1",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: over.designVersionId ?? "d1",
    totalWork: SafeInt(over.totalWork ?? 200),
    completedWork: SafeInt(over.completedWork ?? 0),
    paidWork: SafeInt(0),
    status: over.status ?? "ACTIVE",
    startedAt: "1880-01",
    ...(over.holdUntilMonth === undefined ? {} : { holdUntilMonth: over.holdUntilMonth }),
    ...(over.foreignContractId === undefined ? {} : { foreignContractId: over.foreignContractId }),
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

function nation(projects: ConstructionProject[]): NationState {
  return {
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(1_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
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

/** A complete six-instalment foreign contract funded by its schedule, not yard capacity. */
function foreignContract(): ForeignConstructionContract {
  return buildForeignConstructionContract({
    contractId: "fc-1",
    orderingNationId: "GBR",
    builderNationId: "FRA",
    designVersionId: "d1",
    terms: {
      builderShipyardId: "yard:FRA",
      quantity: 1,
      totalWorkPerUnit: 200,
      totalPriceUnits: 600,
      paymentSchedule: [
        { dueMonth: "1880-01", amountUnits: 100, workShareBp: 2_000 },
        { dueMonth: "1880-02", amountUnits: 100, workShareBp: 1_600 },
        { dueMonth: "1880-03", amountUnits: 100, workShareBp: 1_600 },
        { dueMonth: "1880-04", amountUnits: 100, workShareBp: 1_600 },
        { dueMonth: "1880-05", amountUnits: 100, workShareBp: 1_600 },
        { dueMonth: "1880-06", amountUnits: 100, workShareBp: 1_600 },
      ],
      authorizationMonth: "1880-01",
      plannedKeelMonth: "1880-01",
      plannedDeliveryMonth: "1880-08",
    },
    reservedMassKg: 1_000_000,
    builderCapabilitySnapshotHash: "cap-hash",
  });
}

function snapshot(
  projects: ConstructionProject[],
  designs: Map<string, CompiledDesignVersion> = new Map(),
  nationOverrides: Partial<NationState> = {},
): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "construction-readout",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", { ...nation(projects), ...nationOverrides }]]),
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

describe("constructionProjectQueueWithReadouts (SB3-R31)", () => {
  it("attaches the compiled instalment, remaining months, total cost and launch month", () => {
    const from = snapshot([project({ designVersionId: "d1" })], new Map([["d1", design(25)]]));
    const entries = constructionProjectQueueWithReadouts(from, "GBR", content, "1880-01");
    const entry = entries.find((e) => e.projectId === "proj-1")!;
    expect(entry.readout).toEqual({
      totalCostUnits: 200,
      monthlyInstalmentUnits: 150, // six lines x 25 capacity
      remainingMonths: 2,
      launchMonth: "1880-03",
      scheduleBasis: "YARD_CAPACITY",
      scheduleUnavailableReason: null,
      haltedCarryingCostUnits: null,
    });
  });

  it("gives a HALTED project the half-mothball carrying cost, and a non-halted one null", () => {
    const from = snapshot(
      [project({ id: "halt-1", status: "HALTED" }), project({ id: "work-1", status: "ACTIVE" })],
      new Map([["d1", design(25)]]),
    );
    const entries = constructionProjectQueueWithReadouts(from, "GBR", content, "1880-02");
    const expected = preservationCostUnits(
      content.environmentFor("1880-02").constructionBalance,
      content.treasuryUnitMicro,
    );
    expect(expected).toBeGreaterThan(0);
    expect(entries.find((e) => e.projectId === "halt-1")!.readout!.haltedCarryingCostUnits).toBe(
      expected,
    );
    expect(
      entries.find((e) => e.projectId === "work-1")!.readout!.haltedCarryingCostUnits,
    ).toBeNull();
  });

  it("reports an unknown carrying cost (not zero) when no ship-building content is given", () => {
    const from = snapshot([project({ status: "HALTED" })], new Map([["d1", design(25)]]));
    const entries = constructionProjectQueueWithReadouts(from, "GBR", undefined, "1880-02");
    expect(entries[0]!.readout!.haltedCarryingCostUnits).toBeNull();
  });

  it("leaves readout absent on the plain snapshot queue projection", () => {
    const from = snapshot([project()], new Map([["d1", design(25)]]));
    expect(buildConstructionProjectQueue(from, "GBR")[0]!.readout).toBeUndefined();
  });
});

describe("constructionProjectReadout status awareness (INC-3c, SB3-R31)", () => {
  it("reports no misleading instalment or launch for a held project, and says why", () => {
    for (const status of [
      "HALTED",
      "DELAYED",
      "AWAITING_CAPACITY",
      "IMPOUNDED",
      "CANCELLED",
    ] as const) {
      const readout = constructionProjectReadout(project({ status }), design(25), "1880-01");
      expect(readout.scheduleBasis).toBe("UNAVAILABLE");
      expect(readout.scheduleUnavailableReason).toBe(status);
      expect(readout.monthlyInstalmentUnits).toBe(0);
      expect(readout.remainingMonths).toBe(0);
      expect(readout.launchMonth).toBeNull();
      expect(readout.totalCostUnits).toBe(200);
    }
  });

  it("reports a foreign project with no resolvable contract as unavailable, never yard capacity", () => {
    const readout = constructionProjectReadout(
      project({ designVersionId: "d1", foreignContractId: "fc-missing" }),
      design(25), // yard capacity would be 150/mo — it must not be used
      "1880-01",
    );
    expect(readout.scheduleBasis).toBe("UNAVAILABLE");
    expect(readout.scheduleUnavailableReason).toBe("FOREIGN_CONTRACT_MISSING");
    expect(readout.monthlyInstalmentUnits).toBe(0);
    expect(readout.launchMonth).toBeNull();
  });

  it("treats a revision hold until a future month as unavailable", () => {
    const readout = constructionProjectReadout(
      project({ holdUntilMonth: "1880-05" }),
      design(25),
      "1880-01",
    );
    expect(readout.scheduleBasis).toBe("UNAVAILABLE");
    expect(readout.scheduleUnavailableReason).toBe("REVISION_HOLD");
    expect(readout.monthlyInstalmentUnits).toBe(0);
  });

  it("uses yard capacity for a running project and once the hold has elapsed", () => {
    expect(constructionProjectReadout(project(), design(25), "1880-01").scheduleBasis).toBe(
      "YARD_CAPACITY",
    );
    const ended = constructionProjectReadout(
      project({ holdUntilMonth: "1880-01" }),
      design(25),
      "1880-01",
    );
    expect(ended.scheduleBasis).toBe("YARD_CAPACITY");
    expect(ended.monthlyInstalmentUnits).toBe(150);
  });

  it("derives a foreign project's instalment and launch from its contract schedule, not yard capacity", () => {
    const readout = constructionProjectReadout(
      project({ designVersionId: "d1", foreignContractId: "fc-1" }),
      design(25), // yard capacity is 150/mo — it must be ignored
      "1880-02",
      { contract: foreignContract(), paidDueMonths: ["1880-01"] },
    );
    expect(readout.scheduleBasis).toBe("FOREIGN_CONTRACT");
    expect(readout.scheduleUnavailableReason).toBeNull();
    expect(readout.monthlyInstalmentUnits).toBe(100); // the next unpaid instalment
    expect(readout.remainingMonths).toBe(5);
    expect(readout.launchMonth).toBe("1880-08");
  });

  it("prefers the contract schedule for a foreign project even while it is held (money is still owed)", () => {
    const readout = constructionProjectReadout(
      project({ status: "DELAYED", foreignContractId: "fc-1" }),
      undefined,
      "1880-02",
      { contract: foreignContract(), paidDueMonths: [] },
    );
    expect(readout.scheduleBasis).toBe("FOREIGN_CONTRACT");
    expect(readout.monthlyInstalmentUnits).toBe(100);
    expect(readout.remainingMonths).toBe(6);
  });

  it("reports a completed project as complete, never as held", () => {
    const readout = constructionProjectReadout(
      project({ status: "COMPLETED", completedWork: 200 }),
      design(25),
      "1880-01",
    );
    expect(readout.remainingMonths).toBe(0);
    expect(readout.launchMonth).toBeNull();
    expect(readout.scheduleBasis).toBe("YARD_CAPACITY");
    expect(readout.scheduleUnavailableReason).toBeNull();
  });

  it("fills a foreign row's readout from the nation's contract schedule in the queue", () => {
    const from = snapshot(
      [
        project({ id: "fp-1", designVersionId: "d1", foreignContractId: "fc-1" }),
        project({ id: "hp-1", status: "HALTED" }),
      ],
      new Map([["d1", design(25)]]),
      {
        foreignContracts: [foreignContract()],
        foreignContractPayments: [{ contractId: "fc-1", paidDueMonths: ["1880-01"] }],
      },
    );
    const entries = constructionProjectQueueWithReadouts(from, "GBR", content, "1880-02");
    const foreign = entries.find((e) => e.projectId === "fp-1")!.readout!;
    expect(foreign.scheduleBasis).toBe("FOREIGN_CONTRACT");
    expect(foreign.monthlyInstalmentUnits).toBe(100);
    expect(foreign.launchMonth).toBe("1880-08");
    const held = entries.find((e) => e.projectId === "hp-1")!.readout!;
    expect(held.scheduleBasis).toBe("UNAVAILABLE");
    expect(held.scheduleUnavailableReason).toBe("HALTED");
    expect(held.monthlyInstalmentUnits).toBe(0);
    expect(held.haltedCarryingCostUnits).not.toBeNull();
  });
});
