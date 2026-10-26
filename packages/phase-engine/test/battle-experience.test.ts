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

function makeShip(nationId: string, id: string, over: Partial<Ship> = {}): Ship {
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
    firepower: SafeInt(200),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function makeNation(id: string, ships: Ship[], divisions: PermanentDivision[] = []) {
  return {
    id,
    name: id,
    tag: id,
    prestige: SafeInt(20),
    treasury: SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      { id: `fleet-${id}`, nationId: id, name: `${id} Fleet`, locationAreaId: "a-1", ships },
    ],
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

function makeSnapshot(
  gbrShips: Ship[],
  gbrDivisions: PermanentDivision[],
  fraDivisions: PermanentDivision[],
): CampaignSnapshot {
  const nations = new Map();
  nations.set("GBR", makeNation("GBR", gbrShips, gbrDivisions));
  nations.set(
    "FRA",
    makeNation("FRA", [makeShip("FRA", "f1"), makeShip("FRA", "f2")], fraDivisions),
  );
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "battle-absences",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations,
    wars: {
      wars: [
        {
          id: "war_1",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["GBR"],
          defenderSideMembers: ["FRA"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "GBR",
          defenderId: "FRA",
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "1.0",
    compatibilityVersion: "1.2.0",
  };
}

function division(
  nationId: string,
  divisionId: string,
  shipOrder: string[],
  experience: number,
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
    rulesetVersion: "1.0",
    aggregateHash: "",
  };
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

const scenario = () =>
  makeSnapshot(
    [
      makeShip("GBR", "g1"),
      makeShip("GBR", "g2"),
      makeShip("GBR", "g3", { readiness: "MOTHBALLED" }),
    ],
    [
      division("GBR", "gbr-main", ["g1", "g2"], 20),
      division("GBR", "gbr-idle", ["g3"], 20),
      division("GBR", "gbr-veteran", ["g1"], 99),
    ],
    [division("FRA", "fra-main", ["f1", "f2"], 40)],
  );

function run(active: boolean, snapshot: CampaignSnapshot = scenario()) {
  return new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector(), undefined, {
    playerNationId: "GBR",
    ...(active ? { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES } : {}),
  });
}

const experienceOf = (result: ReturnType<typeof run>, nationId: string, divisionId: string) =>
  result.finalSnapshot.nations.get(nationId)!.divisions.find((d) => d.divisionId === divisionId)!
    .experience as number;

describe("battle experience write-back", () => {
  it("grants every division that fought the ruleset amount, once, and no one else", () => {
    const result = run(true);
    expect(result.finalSnapshot.wars.battles.some((b) => b.phase === "resolved")).toBe(true);
    expect(experienceOf(result, "GBR", "gbr-main")).toBe(23);
    expect(experienceOf(result, "FRA", "fra-main")).toBe(43);
    expect(experienceOf(result, "GBR", "gbr-idle")).toBe(20);
  });

  it("clamps at 100 and records the real delta with a reason code", () => {
    const result = run(true);
    expect(experienceOf(result, "GBR", "gbr-veteran")).toBe(100);
    const events = result.eventLedger.all
      .filter((e) => e.body.kind === "DivisionExperienceChanged")
      .map((e) => e.body);
    const veteran = events.find(
      (body) => body.kind === "DivisionExperienceChanged" && body.divisionId === "gbr-veteran",
    );
    expect(veteran).toMatchObject({
      reasonCode: "BATTLE_PARTICIPATION",
      before: 99,
      after: 100,
      delta: 1,
    });
    const perDivision = events.map((body) =>
      body.kind === "DivisionExperienceChanged" ? `${body.divisionId}/${body.sourceId}` : "",
    );
    expect(new Set(perDivision).size).toBe(perDivision.length);
  });

  it("is deterministic and refreshes the division aggregate hash", () => {
    const a = run(true);
    const b = run(true);
    const find = (r: ReturnType<typeof run>) =>
      r.finalSnapshot.nations.get("GBR")!.divisions.find((d) => d.divisionId === "gbr-main")!;
    expect(find(a).aggregateHash).toBe(find(b).aggregateHash);
    expect(find(a).aggregateHash).toBe(divisionAggregateHash(find(a)));
    expect(find(a).aggregateHash).not.toBe(
      scenario()
        .nations.get("GBR")!
        .divisions.find((d) => d.divisionId === "gbr-main")!.aggregateHash,
    );
  });

  it("changes nothing and emits nothing while the fleet-management section is dormant", () => {
    const result = run(false);
    expect(experienceOf(result, "GBR", "gbr-main")).toBe(20);
    expect(result.eventLedger.all.some((e) => e.body.kind === "DivisionExperienceChanged")).toBe(
      false,
    );
  });
});
