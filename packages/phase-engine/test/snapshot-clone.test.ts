import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, ForeignConstructionContract, Ship } from "@bluewave/campaign";
import { bp, money, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { CLONE_COVERAGE, cloneSnapshot } from "../src/snapshotClone.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeDesign,
  makeShip,
  makeWar,
} from "./battle-fixtures.js";

const STATE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "campaign",
  "src",
  "state.ts",
);
const DIVISION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "campaign",
  "src",
  "division.ts",
);

const OFFICER_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "campaign",
  "src",
  "officers.ts",
);

const STATE_SOURCE = readFileSync(STATE_PATH, "utf8");
const OFFICER_SOURCE = readFileSync(OFFICER_PATH, "utf8");
const DIVISION_SOURCE = readFileSync(DIVISION_PATH, "utf8");

// Type-source enumeration (the audit's ground truth: the campaign interfaces).
// The campaign state model's interfaces are flat; every field is one
// `name: Type;`-style line inside the interface block.

function sourceForType(typeName: string): string {
  if (typeName === "PermanentDivision") return DIVISION_SOURCE;
  if (typeName === "Officer") return OFFICER_SOURCE;
  return STATE_SOURCE;
}

/** All fields of the top-level `export interface <name> { … }` declaration. */
function interfaceFields(name: string): string[] {
  const source = sourceForType(name);
  const header = new RegExp(`export interface ${name}\\s*\\{`);
  const start = source.search(header);
  expect(start, `no interface ${name} declared in the campaign type source`).toBeGreaterThanOrEqual(
    0,
  );
  const bodyStart = source.indexOf("{", start) + 1;
  const close = source.indexOf("\n}", bodyStart);
  expect(close, `interface ${name} block not closed in source`).toBeGreaterThanOrEqual(0);
  const fields: string[] = [];
  for (const line of source.slice(bodyStart, close).split("\n")) {
    const match = line.match(/^\s*([A-Za-z_$][\w$]*)(\?)?:/);
    if (match) {
      const field = match[1]!;
      if (!fields.includes(field)) fields.push(field);
    }
  }
  return fields;
}

//  Graph-isolation helpers (identity checks on reference values).

type RefNode = object;

/** Every reference value (object/array/Map) reachable from `root`. */
function collectReferences(root: unknown, seen = new Set<RefNode>()): Set<RefNode> {
  if (root === null || root === undefined || typeof root !== "object" || seen.has(root))
    return seen;
  seen.add(root);
  if (root instanceof Map) {
    for (const [key, value] of root) {
      collectReferences(key, seen);
      collectReferences(value, seen);
    }
  } else if (Array.isArray(root)) {
    for (const value of root) collectReferences(value, seen);
  } else {
    for (const key of Object.keys(root)) {
      collectReferences((root as Record<string, unknown>)[key], seen);
    }
  }
  return seen;
}

function expectDisjointGraph(left: unknown, right: unknown, label = "object graphs"): void {
  const leftRefs = collectReferences(left);
  const rightRefs = collectReferences(right);
  const shared = (set: Set<RefNode>, probe: Set<RefNode>) => [...set].find((o) => probe.has(o));
  const l = shared(leftRefs, rightRefs);
  const r = shared(rightRefs, leftRefs);
  expect(l === undefined && r === undefined, `${label}: callers share a reference`).toBe(true);
}

//  Rich snapshot fixture: exercises every audited type with nested mutable
//  values so the identity tests genuinely probe deep isolation.

function makeRichSnapshot(): CampaignSnapshot {
  const ships: Ship[] = [
    makeShip("g1", "dv-a", ATTACKER_NATION, { firepower: 200 }),
    makeShip("g2", "dv-b", ATTACKER_NATION, { firepower: 200 }),
    makeShip("f1", "dv-c", DEFENDER_NATION, { firepower: 200 }),
  ];
  const snapshot = makeBattleSnapshot({
    attackerShips: [ships[0]!, ships[1]!],
    defenderShips: [ships[2]!],
    areas: [],
  });

  const gbr = snapshot.nations.get(ATTACKER_NATION)!;
  gbr.homeAreaId = "a-2";
  gbr.research = {
    nationId: ATTACKER_NATION,
    technologies: [
      { techId: "basic_steam", investedPoints: SafeInt(30), completed: false },
      { techId: "dreadnought_hull", investedPoints: SafeInt(0), completed: false },
    ],
    currentProjectTechId: "basic_steam",
    standingResearchBudget: SafeInt(40),
    annualResearchAllocation: SafeInt(480),
    fieldPriorities: { A: SafeInt(50), B: SafeInt(50) },
    researchBudget: SafeInt(100),
    activeCandidates: new Map([["basic_steam", "active"]]),
    discoveredTechs: ["basic_steam", "machinery"],
  };
  gbr.officers = [{ id: "off-1", name: "Test Officer", rank: "CAPTAIN", skill: SafeInt(50) }];
  gbr.divisions = [
    {
      divisionId: "div-1",
      nationId: ATTACKER_NATION,
      shipOrder: ["g1", "g2"],
      flagshipShipId: "g1",
      commanderOfficerId: "officer-1",
      divisionRole: "CORE",
      preferredFormation: "LINE_AHEAD",
      experience: SafeInt(20),
      cohesion: SafeInt(30),
      locationAreaId: "a-1",
      creationMonth: "1880-01",
      lastReorganizationMonth: "1880-01",
      provenanceRefs: ["prov-1"],
      rulesetVersion: "0.1.0",
      aggregateHash: "agg-1",
    },
  ];
  gbr.constructionProjects = [
    {
      id: "proj-1",
      type: "ship",
      projectType: "REBUILD",
      targetShipId: "g1",
      targetId: "g3",
      designVersionId: "dv-b",
      totalWork: SafeInt(200),
      completedWork: SafeInt(50),
      paidWork: SafeInt(50),
      status: "ACTIVE",
      startedAt: "1880-01",
      holdUntilMonth: "1880-03",
      packages: [
        {
          id: "hull",
          kind: "HULL",
          line: "slipway",
          totalWork: SafeInt(150),
          doneWork: SafeInt(50),
          dependsOn: [],
        },
        {
          id: "launch",
          kind: "LAUNCH",
          line: "slipway",
          totalWork: SafeInt(50),
          doneWork: SafeInt(0),
          dependsOn: ["hull"],
        },
      ],
      yardId: "yard_small",
      monthUsage: {
        month: "1880-02",
        used: { slipway: SafeInt(50) },
        startDone: { hull: SafeInt(0), launch: SafeInt(0) },
      },
      nationalProfileId: "uk",
      costMultiplierBp: 9800,
      buildTimeMultiplierBp: 9300,
      capacityUnits: { slipway: SafeInt(4) },
      newConstructionReservedMassKg: 2_000_000,
      shipName: "Devastation",
      batchId: "batch-1",
      namedClassId: "dv-b-family",
      batchOrdinal: 1,
      namePoolId: "name_pool:uk:B",
      namePoolOrdinal: 1,
      accelerationPremiumAppliedAtWorkPosition: SafeInt(50),
      elapsedActiveMonths: 3,
      dockExpansionDurationMonths: 12,
      dockExpansionStepKg: 1_000_000,
      foreignContractId: "fc-1",
      foreignBuilderNationId: DEFENDER_NATION,
      delayReasonCode: "PAYMENT_DEFAULT_DELAYED",
    },
  ];
  gbr.aircraft = {} as any;
  gbr.carrierOperations = {} as any;
  gbr.dock = {
    maximumNewConstructionMassKg: 13_000_000,
    maximumMajorRepairMassKg: 13_000_000,
    maximumRebuildMassKg: 13_000_000,
    maximumConversionMassKg: 13_000_000,
  };
  gbr.dockExpansion = {
    possessions: [
      {
        possessionId: "gbr-lon",
        eligible: true,
        utilization: [{ month: "1880-01", utilizationBp: 8_000 }],
      },
    ],
    lastOpportunityMonth: "1880-01",
  };
  gbr.procurementIntents = [
    {
      procurementDecisionId: "uk:1:CL:1",
      nationId: "uk",
      role: "CL",
      shipType: "CL",
      candidateDesignId: "uk_CL_1",
      submittedDesignId: "des_ai_uk_1_CL_1",
      designStudyId: "study_des_ai_uk_1_CL_1",
      constructionProjectId: null,
      status: "STUDY_SUBMITTED",
      attemptNumber: 1,
      createdAtMonth: "1880-01",
      lastUpdatedAtMonth: "1880-01",
      budgetCeiling: SafeInt(800),
      dockRequirement: null,
      decisionSeed: "seed:procurement:uk:1:CL:1",
      reason: null,
    },
  ];
  const foreignContract: ForeignConstructionContract = {
    contractId: "fc-1",
    orderingNationId: ATTACKER_NATION,
    builderNationId: DEFENDER_NATION,
    builderShipyardId: "yard-fra-1",
    designVersionId: "dv-b",
    quantity: 1,
    totalWorkPerUnit: 200,
    totalPriceUnits: money(2_000),
    currencyUnit: "treasury_unit",
    paymentSchedule: [{ dueMonth: "1880-01", amountUnits: money(2_000), workShareBp: bp(10_000) }],
    capacityReservationSchedule: [
      { month: "1880-01", reservedMassKg: 2_000_000, pool: "NEW_CONSTRUCTION" },
    ],
    authorizationMonth: "1880-01",
    plannedKeelMonth: "1880-02",
    plannedDeliveryMonth: "1880-06",
    builderCapabilitySnapshotHash: "cap-hash",
    technologyTransferPolicyId: "foreign_construction_insight_v1",
    warDelayPolicyId: "foreign_contract_war_policy_v1",
    impoundmentPolicyId: "foreign_contract_impoundment_v1",
    deliveryGuaranteeClauseId: "NONE",
    occupationDestructionPolicyId: "foreign_contract_occupation_destruction_v1",
    cancellationRefundPolicyId: "foreign_contract_cancellation_refund_v1",
    governingTreatyIds: ["treaty-1"],
    rulesetVersion: "1.0.0",
    formulaVersion: "foreign_construction_contract_v1",
    contractHash: "0".repeat(64),
  };
  gbr.foreignContracts = [foreignContract];
  gbr.foreignContractPayments = [{ contractId: "fc-1", paidDueMonths: ["1880-01"] }];
  gbr.foreignInsightAwards = [
    {
      contractId: "fc-1",
      milestones: ["DESIGN_STUDY"],
      awardedByFamily: { HULL_CONSTRUCTION: 500 },
    },
  ];
  gbr.foreignContractImpoundments = [
    {
      contractId: "fc-1",
      authorizingPredicate: "foreign_contract_war_policy_v1:IMPOUND",
      custodyNationId: DEFENDER_NATION,
      legalTitle: "ORDERING_NATION",
      paidAmountUnits: 500,
      unpaidAmountUnits: 500,
      compensationOrForfeiture: "COMPENSATION",
      projectStatus: "IMPOUNDED",
      futureDeliveryEligible: false,
      month: "1880-02",
    },
  ];

  const fra = snapshot.nations.get(DEFENDER_NATION)!;
  fra.research = {
    nationId: DEFENDER_NATION,
    technologies: [],
    currentProjectTechId: undefined,
    fieldPriorities: {},
    researchBudget: SafeInt(0),
    activeCandidates: new Map(),
    discoveredTechs: [],
  };

  snapshot.wars.wars = [{ ...makeWar(), endDate: "1881-01" }];
  const battle = makeBattle();
  battle.manifestHash = "manifest-hash";
  battle.result = {
    winnerId: DEFENDER_NATION,
    loserId: ATTACKER_NATION,
    attackerLosses: ["g1"],
    defenderLosses: [],
    damageReport: { "f1-id": SafeInt(10) },
    explanation: ["g1 sunk"],
    lostShips: [
      {
        shipId: "g1",
        name: "HMS Lost",
        classId: "c",
        nationId: "GBR",
        month: "1880-03",
        cause: "gunfire",
      },
    ],
  };
  snapshot.wars.battles = [battle];
  snapshot.wars.participantMemberships = [
    {
      warId: "war_1",
      nationId: ATTACKER_NATION,
      sideId: "side_a",
      entryMonth: "1880-01",
      status: "ACTIVE",
      nationalContributionPoints: 1,
    },
    {
      warId: "war_1",
      nationId: DEFENDER_NATION,
      sideId: "side_d",
      entryMonth: "1880-01",
      status: "ACTIVE",
      nationalContributionPoints: 1,
    },
  ];
  snapshot.wars.blockadeState = [
    {
      blockaderId: DEFENDER_NATION,
      blockadedNationId: ATTACKER_NATION,
      areaId: "a-1",
      establishedMonth: "1880-01",
    },
  ];
  snapshot.wars.declinedBattles = [
    {
      battleId: "battle-declined",
      warId: "war_1",
      nationId: ATTACKER_NATION,
      areaId: "a-1",
      month: "1880-01",
      missionType: "FLEET_BATTLE",
      responseInputHash: "a".repeat(64),
      victoryPointCost: 4,
      opponentCredit: 0,
    },
  ];
  snapshot.wars.declineCounters = [
    {
      key: `WAR|war_1|${ATTACKER_NATION}`,
      nationId: ATTACKER_NATION,
      lastWarId: "war_1",
      count: 1,
      decayAnchorMonth: "1880-01",
    },
  ];
  snapshot.wars.battleManifests = [
    {
      battleId: "battle-1",
      opportunityId: "opp-001",
      warId: "war_1",
      areaId: "a-1",
      missionType: "open_fleet_engagement",
      attackerId: ATTACKER_NATION,
      defenderId: DEFENDER_NATION,
      acceptanceClass: "accepted",
      missionObjectives: ["destroy_defenders"],
      sides: [
        { sideId: "ATTACKER", participantIds: [ATTACKER_NATION] },
        { sideId: "DEFENDER", participantIds: [DEFENDER_NATION] },
      ],
      persistentAssets: [],
      temporaryAssets: [],
      permanentDivisionIds: [],
      tacticalDivisions: [],
      commanders: [],
      weather: "clear",
      seaState: "calm",
      visibility: "good",
      environment: "open_sea",
      sourceStateHashes: { state: "abc" },
      reservations: [],
      autoResolutionProof: "auto-resolvable",
      provenanceRecords: [],
      battleSeed: "seed",
      rulesetVersion: "0.1.0",
      formulaVersion: "f1",
      aiPolicyVersion: "a1",
      rngVersion: "rng_v1",
      contentVersion: "fixture_v1",
      manifestHash: "manifest-hash",
    },
  ];

  snapshot.politics.relations = [
    {
      nationA: ATTACKER_NATION,
      nationB: DEFENDER_NATION,
      relation: "at_war",
      tension: 10,
      nap: false,
      since: "1880-01",
    },
  ];
  snapshot.politics.shells = { plot: { x: 1 } };
  snapshot.intelligence.shells = { knownFleets: ["g1", "g2"] };
  snapshot.designs = new Map([
    ["dv-a", makeDesign("dv-a", ATTACKER_NATION)],
    ["dv-b", makeDesign("dv-b", ATTACKER_NATION)],
    ["dv-c", makeDesign("dv-c", DEFENDER_NATION)],
  ]);
  snapshot.nations.get(ATTACKER_NATION)!.designStudies = [
    {
      designStudyId: "study_dv-s",
      nationId: ATTACKER_NATION,
      builderContext: "NATIONAL",
      baselineDesignVersionId: "dv-a",
      designFamilyId: "family-a",
      newFamily: false,
      derived: true,
      failedCriteria: [],
      baseStudyWork: 4,
      baseStudyCost: money(8),
      discountBp: bp(2500),
      finalStudyWork: 3,
      finalStudyCost: money(6),
      workDone: 1,
      costPaid: money(2),
      status: "IN_PROGRESS",
      startMonth: "1880-01",
      completionMonth: null,
      rulesetVersion: "1.0.0",
      formulaVersion: "design_study_v1",
      projectHash: "h",
      design: makeDesign("dv-s", ATTACKER_NATION),
    },
  ];
  snapshot.designFamilies = new Map([
    [
      "family-a",
      {
        designFamilyId: "family-a",
        nationId: ATTACKER_NATION,
        rootDesignVersionId: "dv-a",
        memberDesignVersionIds: ["dv-a", "dv-b"],
        familyCreationMonth: "1880-01",
      },
    ],
  ]);
  snapshot.world = {
    areas: [
      { id: "a-1", name: "Area One", type: "sea" },
      { id: "a-2", name: "Area Two", type: "coastal", controller: ATTACKER_NATION },
    ],
    routes: [{ id: "r-1", from: "a-1", to: "a-2", type: "sea", distance: SafeInt(10) }],
    ports: [
      { id: "p-1", name: "Port One", areaId: "a-2", nationId: ATTACKER_NATION, level: SafeInt(1) },
    ],
    possessions: [{ id: "poss-1", nationId: ATTACKER_NATION, areaId: "a-2" }],
  };
  return snapshot;
}

const CANONICAL_CLONE_TYPES = [
  "Ship",
  "FleetState",
  "TechnologyProgress",
  "TechnologyDefinitionData",
  "ResearchState",
  "PermanentDivision",
  "Officer",
  "ConstructionProject",
  "ConstructionPackage",
  "ConstructionMonthUsage",
  "NationState",
  "DiplomaticRelation",
  "PoliticalState",
  "IntelligenceState",
  "AreaData",
  "RouteData",
  "PortData",
  "PossessionData",
  "WorldState",
  "WarDeclaration",
  "WarParticipantMembership",
  "BlockadeState",
  "BattleInstance",
  "BattleResult",
  "BattleManifest",
  "BattleManifestSide",
  "DeclineCounterEntry",
  "DeclinedBattleRecord",
  "WarState",
  "CampaignSlot",
  "CompiledDesignVersion",
  "DesignFamily",
  "DesignStudy",
  "ForeignConstructionContract",
  "ForeignContractPaymentRecord",
  "ForeignContractImpoundmentRecord",
  "ForeignInsightAwardRecord",
  "CampaignWeatherState",
  "CampaignSnapshot",
] as const;

describe("snapshotClone — field-exhaustive clone coverage audit", () => {
  it("covers every field of every cloned snapshot type", () => {
    for (const typeName of Object.keys(CLONE_COVERAGE)) {
      const cloneFields = CLONE_COVERAGE[typeName]!;
      const declared = interfaceFields(typeName);
      expect([...cloneFields].sort(), typeName).toEqual([...declared].sort());
    }
  });

  it("covers exactly the canonical cloned snapshot-type surface (no type silently dropped)", () => {
    expect(Object.keys(CLONE_COVERAGE).sort()).toEqual([...CANONICAL_CLONE_TYPES].sort());
  });

  it("the clone produces runtime objects carrying exactly the covered fields", () => {
    const clone = cloneSnapshot(makeRichSnapshot());
    expect(Object.keys(clone).sort()).toEqual([...CLONE_COVERAGE.CampaignSnapshot!].sort());
    const gbr = clone.nations.get(ATTACKER_NATION)!;
    expect(Object.keys(gbr).sort()).toEqual([...CLONE_COVERAGE.NationState!].sort());
    expect(Object.keys(gbr.research).sort()).toEqual([...CLONE_COVERAGE.ResearchState!].sort());
    expect(Object.keys(gbr.fleets[0]!).sort()).toEqual([...CLONE_COVERAGE.FleetState!].sort());
    expect(Object.keys(gbr.fleets[0]!.ships[0]!).sort()).toEqual([...CLONE_COVERAGE.Ship!].sort());
    expect(Object.keys(gbr.officers![0]!).sort()).toEqual([...CLONE_COVERAGE.Officer!].sort());
    expect(Object.keys(gbr.divisions[0]!).sort()).toEqual(
      [...CLONE_COVERAGE.PermanentDivision!].sort(),
    );
    expect(Object.keys(gbr.designStudies![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.DesignStudy!].sort(),
    );
    expect(Object.keys(gbr.constructionProjects[0]!).sort()).toEqual(
      [...CLONE_COVERAGE.ConstructionProject!].sort(),
    );
    expect(Object.keys(gbr.constructionProjects[0]!.packages![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.ConstructionPackage!].sort(),
    );
    expect(Object.keys(gbr.constructionProjects[0]!.monthUsage!).sort()).toEqual(
      [...CLONE_COVERAGE.ConstructionMonthUsage!].sort(),
    );
    expect(Object.keys(gbr.foreignInsightAwards![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.ForeignInsightAwardRecord!].sort(),
    );
    expect(Object.keys(gbr.foreignContractImpoundments![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.ForeignContractImpoundmentRecord!].sort(),
    );
    expect(Object.keys(clone.wars.wars[0]!).sort()).toEqual(
      [...CLONE_COVERAGE.WarDeclaration!].sort(),
    );
    expect(Object.keys(clone.wars.battles[0]!).sort()).toEqual(
      [...CLONE_COVERAGE.BattleInstance!].sort(),
    );
    expect(Object.keys(clone.wars.battles[0]!.result!).sort()).toEqual(
      [...CLONE_COVERAGE.BattleResult!].sort(),
    );
    expect(Object.keys(clone.wars.battleManifests![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.BattleManifest!].sort(),
    );
    expect(Object.keys(clone.wars.declineCounters![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.DeclineCounterEntry!].sort(),
    );
    expect(Object.keys(clone.wars.declinedBattles![0]!).sort()).toEqual(
      [...CLONE_COVERAGE.DeclinedBattleRecord!].sort(),
    );
  });
});

describe("snapshotClone — deep isolation (identity checks, not value equality)", () => {
  it("clone produces a fully disjoint object graph from its input", () => {
    const input = makeRichSnapshot();
    const clone = cloneSnapshot(input);
    expectDisjointGraph(input, clone, "clone vs input");
  });

  it("mutating a clone's ship/nation/research/war object never mutates the caller's snapshot", () => {
    const input = makeRichSnapshot();
    const clone = cloneSnapshot(input);

    const inputNation = input.nations.get(ATTACKER_NATION)!;
    const cloneNation = clone.nations.get(ATTACKER_NATION)!;
    expect(cloneNation).not.toBe(inputNation);

    // ship
    cloneNation.fleets[0]!.ships[0]!.hitPoints = SafeInt(1);
    expect(inputNation.fleets[0]!.ships[0]!.hitPoints).not.toBe(1);
    // nation treasury
    cloneNation.treasury = SafeInt(-1);
    expect(inputNation.treasury as number).not.toBe(-1);
    // research
    cloneNation.research.technologies[0]!.investedPoints = SafeInt(999);
    expect(inputNation.research.technologies[0]!.investedPoints as number).not.toBe(999);
    cloneNation.research.fieldPriorities["ADDED"] = SafeInt(1);
    expect(inputNation.research.fieldPriorities["ADDED"]).toBeUndefined();
    cloneNation.research.activeCandidates.set("extra", "x");
    expect(inputNation.research.activeCandidates.has("extra")).toBe(false);
    // war
    const inputWar = input.wars.wars[0]!;
    const cloneWar = clone.wars.wars[0]!;
    expect(cloneWar).not.toBe(inputWar);
    cloneWar.attackerWarScore = 99;
    expect(inputWar.attackerWarScore).toBe(0);
    cloneWar.attackerSideMembers.push("XX");
    expect(inputWar.attackerSideMembers).toHaveLength(1);
    // battle result damage map
    const inputBattleResult = input.wars.battles[0]!.result!;
    const cloneBattleResult = clone.wars.battles[0]!.result!;
    expect(cloneBattleResult).not.toBe(inputBattleResult);
    cloneBattleResult.damageReport["shield"] = SafeInt(999);
    expect(inputBattleResult.damageReport["shield"]).toBeUndefined();
    // design family member array
    const inputFamily = input.designFamilies.get("family-a")!;
    const cloneFamily = clone.designFamilies.get("family-a")!;
    expect(cloneFamily).not.toBe(inputFamily);
    cloneFamily.memberDesignVersionIds.push("SHARED");
    expect(inputFamily.memberDesignVersionIds).toHaveLength(2);
    // foreign insight award (nested record + per-family number map)
    const inputAwards = input.nations.get(ATTACKER_NATION)!.foreignInsightAwards!;
    const cloneAwards = cloneNation.foreignInsightAwards!;
    expect(cloneAwards[0]).not.toBe(inputAwards[0]);
    cloneAwards[0]!.awardedByFamily["HULL_CONSTRUCTION"] = 9_999;
    expect(inputAwards[0]!.awardedByFamily["HULL_CONSTRUCTION"]).toBe(500);
    cloneAwards[0]!.milestones.push("DELIVERY");
    expect(inputAwards[0]!.milestones).toHaveLength(1);
    // world route
    const inputRoute = input.world.routes[0]!;
    const cloneRoute = clone.world.routes[0]!;
    expect(cloneRoute).not.toBe(inputRoute);
    cloneRoute.distance = SafeInt(0);
    expect(inputRoute.distance as number).toBe(10);
    // world possession
    const inputPossession = input.world.possessions![0]!;
    const clonePossession = clone.world.possessions![0]!;
    expect(clonePossession).not.toBe(inputPossession);
    clonePossession.nationId = "mutated";
    expect(inputPossession.nationId).toBe(ATTACKER_NATION);
    // politics shell
    const inputShells = input.politics.shells;
    const cloneShells = clone.politics.shells;
    expect(cloneShells).not.toBe(inputShells);
    cloneShells["plot"] = "MUTATED";
    expect(inputShells["plot"]).toEqual({ x: 1 });
  });

  it("clone serializes to identical canonical bytes (no field dropped or changed)", () => {
    const input = makeRichSnapshot();
    expect(canonicalSerialize(cloneSnapshot(input))).toBe(canonicalSerialize(input));
  });
});

describe("MonthExecutor — consecutive month executions", () => {
  it("two consecutive executions operate on disjoint object graphs", () => {
    const input = makeBattleSnapshot();
    const month1 = new MonthExecutor().execute(input, [], "seed-1", new DiagnosticCollector());
    const month2 = new MonthExecutor().execute(
      month1.finalSnapshot,
      [],
      "seed-2",
      new DiagnosticCollector(),
    );

    // the caller's snapshot is never aliased by the engine working snapshot.
    expectDisjointGraph(input, month1.finalSnapshot, "input vs month-1");
    // month 1's shipped objects are not aliased by month 2's working graph.
    expectDisjointGraph(month1.finalSnapshot, month2.finalSnapshot, "month-1 vs month-2");

    // a mutation in month-2's output leaves month-1's shipped objects untouched.
    const month1Attacker = month1.finalSnapshot.nations.get(ATTACKER_NATION)!;
    const month2Attacker = month2.finalSnapshot.nations.get(ATTACKER_NATION)!;
    const shippedTreasury = month1Attacker.treasury as number;
    const shippedResearchBudget = month1Attacker.research.researchBudget as number;
    month2Attacker.treasury = SafeInt(-1);
    month2Attacker.research.researchBudget = SafeInt(-1);
    expect(month1Attacker.treasury as number).toBe(shippedTreasury);
    expect(month1Attacker.research.researchBudget as number).toBe(shippedResearchBudget);
  });
});
