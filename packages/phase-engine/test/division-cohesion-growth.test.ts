import {
  campaignMonthId,
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

const MONTH = campaignMonthId(1880, 1, 1);

function makeShip(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId: "GBR",
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

function makeDivision(over: Partial<PermanentDivision> = {}): PermanentDivision {
  const base: PermanentDivision = {
    divisionId: "d1",
    nationId: "GBR",
    shipOrder: ["s1", "s2"],
    flagshipShipId: "s1",
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
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

function makeSnapshot(ships: Ship[], divisions: PermanentDivision[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "cohesion-growth",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          prestige: SafeInt(20),
          id: "GBR",
          name: "GBR",
          tag: "GBR",
          treasury: SafeInt(10000),
          income: SafeInt(100),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          fleets: [
            { id: "fleet-GBR", nationId: "GBR", name: "GBR Fleet", locationAreaId: "a-1", ships },
          ],
          divisions,
          research: {
            nationId: "GBR",
            technologies: [],
            fieldPriorities: {},
            researchBudget: SafeInt(0),
            activeCandidates: new Map(),
            discoveredTechs: [],
          },
          constructionProjects: [],
          isPlayable: true,
          isAI: false,
        },
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

function cohesionAfter(ships: Ship[], division: PermanentDivision, active = true): number {
  const result = new MonthExecutor().execute(
    makeSnapshot(ships, [division]),
    [],
    "seed",
    new DiagnosticCollector(),
    undefined,
    active ? { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES } : {},
  );
  return result.finalSnapshot.nations.get("GBR")!.divisions[0]!.cohesion as number;
}

const FLEET = [makeShip("s1"), makeShip("s2")];

describe("monthly division cohesion growth", () => {
  it("grows a settled division by the ruleset step", () => {
    expect(cohesionAfter(FLEET, makeDivision())).toBe(32);
  });

  it("does not grow in the month the division was reorganised", () => {
    expect(cohesionAfter(FLEET, makeDivision({ lastReorganizationMonth: MONTH }))).toBe(30);
  });

  it("does not grow while a member is not ACTIVE or is unavailable", () => {
    for (const slow of [
      makeShip("s2", { readiness: "RESERVE" }),
      makeShip("s2", { readiness: "MOTHBALLED" }),
      makeShip("s2", { availability: "UNAVAILABLE" }),
    ]) {
      expect(cohesionAfter([makeShip("s1"), slow], makeDivision())).toBe(30);
    }
  });

  it("counts a member that finishes working up this month as ACTIVE", () => {
    const finishing = makeShip("s2", { readiness: "WORKING_UP", crewQuality: SafeInt(59) });
    expect(cohesionAfter([makeShip("s1"), finishing], makeDivision())).toBe(32);
  });

  it("stops at the cap", () => {
    expect(cohesionAfter(FLEET, makeDivision({ cohesion: SafeInt(89) }))).toBe(90);
    expect(cohesionAfter(FLEET, makeDivision({ cohesion: SafeInt(90) }))).toBe(90);
  });

  it("is dormant without the fleet-management section", () => {
    expect(cohesionAfter(FLEET, makeDivision(), false)).toBe(30);
  });
});
