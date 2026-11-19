import {
  divisionAggregateHash,
  type CampaignSnapshot,
  type PermanentDivision,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_FLEET_MANAGEMENT_RULES, FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

type Rules = typeof FIXTURE_FLEET_MANAGEMENT_RULES;

const SERVICE_RULES: Rules = {
  ...FIXTURE_FLEET_MANAGEMENT_RULES,
  divisionExperience: {
    ...FIXTURE_FLEET_MANAGEMENT_RULES.divisionExperience,
    service: { monthlyGrowth: 1, cap: 40 },
  },
};

function makeShip(id: string, nationId: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId,
    locationAreaId: "a-1",
    designVersionId: "",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function makeDivision(
  nationId: string,
  divisionId: string,
  shipOrder: string[],
  experience: number,
  over: Partial<PermanentDivision> = {},
): PermanentDivision {
  const base: PermanentDivision = {
    divisionId,
    nationId,
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(experience),
    cohesion: SafeInt(30),
    locationAreaId: "a-1",
    creationMonth: "1879-06",
    lastReorganizationMonth: "1879-06",
    provenanceRefs: [],
    rulesetVersion: "0.1.0",
    aggregateHash: "",
    ...over,
  };
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

function nationState(id: string, ships: Ship[], divisions: PermanentDivision[]) {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: SafeInt(10000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: `fleet-${id}`, nationId: id, name: id, locationAreaId: "a-1", ships }],
    divisions,
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function makeSnapshot(): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "service-experience",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        nationState(
          "GBR",
          [
            makeShip("g1", "GBR"),
            makeShip("g2", "GBR"),
            makeShip("g3", "GBR", { readiness: "RESERVE" }),
          ],
          [
            makeDivision("GBR", "gbr-b", ["g2"], 20),
            makeDivision("GBR", "gbr-a", ["g1"], 39),
            makeDivision("GBR", "gbr-idle", ["g3"], 20),
            makeDivision("GBR", "gbr-veteran", ["g1"], 70),
          ],
        ),
      ],
      [
        "FRA",
        nationState("FRA", [makeShip("f1", "FRA")], [makeDivision("FRA", "fra-a", ["f1"], 20)]),
      ],
    ]),
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
    compatibilityVersion: "3.0.0",
  };
}

function run(rules: Rules | undefined, snapshot = makeSnapshot()) {
  return new MonthExecutor().execute(
    snapshot,
    [],
    "seed",
    new DiagnosticCollector(),
    undefined,
    rules === undefined ? {} : { fleetManagement: rules },
  );
}

const experienceOf = (result: ReturnType<typeof run>, nationId: string, divisionId: string) =>
  result.finalSnapshot.nations.get(nationId)!.divisions.find((d) => d.divisionId === divisionId)!
    .experience as number;

describe("monthly division service experience", () => {
  it("grows eligible divisions by the ruleset step and stops at the cap", () => {
    const result = run(SERVICE_RULES);
    expect(experienceOf(result, "GBR", "gbr-b")).toBe(21);
    expect(experienceOf(result, "GBR", "gbr-a")).toBe(40);
    expect(experienceOf(result, "FRA", "fra-a")).toBe(21);
  });

  it("leaves ineligible divisions and veterans above the cap untouched", () => {
    const result = run(SERVICE_RULES);
    expect(experienceOf(result, "GBR", "gbr-idle")).toBe(20);
    expect(experienceOf(result, "GBR", "gbr-veteran")).toBe(70);
  });

  it("records one SERVICE_TIME event per change ordered by nation then division", () => {
    const result = run(SERVICE_RULES);
    const bodies = result.eventLedger.all
      .map((event) => event.body)
      .flatMap((body) => (body.kind === "DivisionExperienceChanged" ? [body] : []));
    expect(bodies.map((body) => `${body.nationId}/${body.divisionId}`)).toEqual([
      "FRA/fra-a",
      "GBR/gbr-a",
      "GBR/gbr-b",
    ]);
    expect(bodies[1]).toMatchObject({
      reasonCode: "SERVICE_TIME",
      sourceId: "1880-02",
      before: 39,
      after: 40,
      delta: 1,
    });
  });

  it("refreshes the aggregate hash and is deterministic", () => {
    const find = (r: ReturnType<typeof run>) =>
      r.finalSnapshot.nations.get("GBR")!.divisions.find((d) => d.divisionId === "gbr-b")!;
    const a = find(run(SERVICE_RULES));
    expect(a.aggregateHash).toBe(divisionAggregateHash(a));
    expect(a.aggregateHash).toBe(find(run(SERVICE_RULES)).aggregateHash);
  });

  it("is dormant without the service block or without the section", () => {
    for (const rules of [FIXTURE_FLEET_MANAGEMENT_RULES, undefined]) {
      const result = run(rules);
      expect(experienceOf(result, "GBR", "gbr-b")).toBe(20);
      expect(
        result.eventLedger.all.some((event) => event.body.kind === "DivisionExperienceChanged"),
      ).toBe(false);
    }
  });
});
