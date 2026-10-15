import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";

export interface GenShipSpec {
  id: string;
  classId: string;
  shipType: string;
  locationAreaId: string;
  firepower: number;
  hitPoints: number;
  underConstruction?: boolean;
  inBattleId?: string;
}

export function buildShip(spec: GenShipSpec): Ship {
  return {
    id: spec.id,
    name: spec.id,
    classId: spec.classId,
    nationId: spec.id.startsWith("gb_") ? "GBR" : "FRA",
    locationAreaId: spec.locationAreaId,
    designVersionId: `des_${spec.shipType}`,
    hitPoints: SafeInt(spec.hitPoints),
    maxHitPoints: SafeInt(spec.hitPoints),
    speed: SafeInt(20),
    firepower: SafeInt(spec.firepower),
    armor: SafeInt(10),
    isUnderConstruction: spec.underConstruction ?? false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    inBattleId: spec.inBattleId,
  };
}

export function makeNation(
  id: string,
  ships: Ship[],
  overrides: Partial<NationState> = {},
): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(1000),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `${id}_fleet`,
        nationId: id,
        name: `${id} Fleet`,
        locationAreaId: "area_battle",
        ships,
      },
    ],
    divisions: [],
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
    ...overrides,
  };
}

export function makeActiveWar(warId = "war_1"): CampaignSnapshot["wars"]["wars"][number] {
  return {
    id: warId,
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
  };
}

export function buildGenerationSnapshot(
  gbShips: Ship[],
  fraShips: Ship[],
  overrides: Partial<CampaignSnapshot> = {},
): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("GBR", makeNation("GBR", gbShips));
  nations.set("FRA", makeNation("FRA", fraShips));
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "generation-fixture",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [] },
    nations,
    wars: {
      wars: [makeActiveWar()],
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
    ...overrides,
  };
}

export function defaultTwoNationFixture(): CampaignSnapshot {
  return buildGenerationSnapshot(
    [
      buildShip({
        id: "gb_bb1",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "gb_bb2",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 28,
        hitPoints: 95,
      }),
      buildShip({
        id: "gb_cl1",
        classId: "cruiser",
        shipType: "CL",
        locationAreaId: "area_battle",
        firepower: 12,
        hitPoints: 40,
      }),
    ],
    [
      buildShip({
        id: "fra_bb1",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 26,
        hitPoints: 90,
      }),
      buildShip({
        id: "fra_cl1",
        classId: "cruiser",
        shipType: "CL",
        locationAreaId: "area_battle",
        firepower: 10,
        hitPoints: 35,
      }),
    ],
  );
}
