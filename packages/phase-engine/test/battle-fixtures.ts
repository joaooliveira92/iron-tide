// B-6 INC-3 shared test fixture: a small 2-nation war campaign whose battles
// run through MonthExecutor's battle_resolution phase — either
// battle_generation-driven (armed ships + committed strategic weather) or
// hand-constructed (controlled manifests / manifest-less legacy battles /
// broken-invariant failures). Deterministic; no ambient clock/random/env
// (the only randomness is the keyed campaign seed).

import type {
  BattleInstance,
  BattleManifest,
  CampaignSlot,
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  Ship,
  WarDeclaration,
} from "@bluewave/campaign";
import { buildManifest } from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

export const BATTLE_AREA = "a-1";
export const ATTACKER_NATION = "GBR";
export const DEFENDER_NATION = "FRA";
export const CAMPAIGN_SEED = "b6-inc3-seed";

const UMS_PER_KNOT = 514_444;

export function makeDesign(
  designVersionId: string,
  nationId: string,
  opts: { guns?: number; caliberUm?: number; armorUm?: number; speedKnots?: number } = {},
): CompiledDesignVersion {
  const guns = opts.guns ?? 10;
  const speedUms = Math.floor((opts.speedKnots ?? 30) * UMS_PER_KNOT);
  return {
    designVersionId,
    designFamilyId: `${designVersionId}-family`,
    className: `Class ${designVersionId}`,
    nationId,
    hullType: guns === 0 ? "destroyer" : "battleship",
    normalizedDisplacementKg: SafeInt(30_000_000),
    normalizedSpeedUms: SafeInt(speedUms),
    normalizedArmorUm: SafeInt(opts.armorUm ?? 305_000),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(opts.caliberUm ?? 343_000),
    mainGunsCount: SafeInt(guns),
    machineryType: "steam_triple_expansion",
    crewComplement: SafeInt(1_000),
    contentVersion: "fixture_v1",
    compiledHash: `compiled-${designVersionId}`,
  };
}

export interface FixtureShipOpts {
  firepower?: number;
  hp?: number;
  armor?: number;
  underConstruction?: boolean;
  inBattleId?: string;
  loc?: string;
  availability?: Ship["availability"];
  availabilityProjectId?: string;
  readiness?: Ship["readiness"];
  crewQuality?: number;
  repairMonthsRemaining?: number;
  stationAssignment?: Ship["stationAssignment"];
}

export function makeShip(
  id: string,
  designVersionId: string,
  nationId: string,
  opts: FixtureShipOpts = {},
): Ship {
  return {
    id,
    name: id,
    classId: designVersionId,
    nationId,
    locationAreaId: opts.loc ?? BATTLE_AREA,
    designVersionId,
    hitPoints: SafeInt(opts.hp ?? 100),
    maxHitPoints: SafeInt(opts.hp ?? 100),
    speed: SafeInt(30),
    firepower: SafeInt(opts.firepower ?? 10),
    armor: SafeInt(opts.armor ?? 12),
    isUnderConstruction: opts.underConstruction ?? false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: opts.readiness ?? "ACTIVE",
    crewQuality: SafeInt(opts.crewQuality ?? 100),
    repairMonthsRemaining:
      opts.repairMonthsRemaining === undefined ? undefined : SafeInt(opts.repairMonthsRemaining),
    stationAssignment: opts.stationAssignment,
    inBattleId: opts.inBattleId,
    availability: opts.availability,
    availabilityProjectId: opts.availabilityProjectId,
  };
}

export function makeNation(id: string, ships: Ship[]): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: `${id} Fleet`,
        ships,
        locationAreaId: ships[0]?.locationAreaId ?? BATTLE_AREA,
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
    aircraft: {} as Record<string, unknown>,
    carrierOperations: {} as Record<string, unknown>,
    isPlayable: id === ATTACKER_NATION,
    isAI: id !== ATTACKER_NATION,
  };
}

export function makeWar(overrides: Partial<WarDeclaration> = {}): WarDeclaration {
  return {
    id: "war_1",
    attackerSideId: "side_a",
    defenderSideId: "side_d",
    attackerSideMembers: [ATTACKER_NATION],
    defenderSideMembers: [DEFENDER_NATION],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: ATTACKER_NATION,
    defenderId: DEFENDER_NATION,
    startDate: "1880-01",
    status: "ACTIVE",
    ...overrides,
  };
}

export function makeBattle(overrides: Partial<BattleInstance> = {}): BattleInstance {
  return {
    id: "battle-1",
    phase: "pending",
    attackerId: ATTACKER_NATION,
    defenderId: DEFENDER_NATION,
    areaId: BATTLE_AREA,
    attackerFleetIds: [`fleet-${ATTACKER_NATION}`],
    defenderFleetIds: [`fleet-${DEFENDER_NATION}`],
    ...overrides,
  };
}

/**
 * Build a battle manifest via @bluewave/combat's canonical builder (the same
 * seam battle_generation uses) and return it as a snapshot-storable manifest.
 */
export function buildBattleManifest(
  overrides: Partial<Parameters<typeof buildManifest>[0]> = {},
): BattleManifest {
  const base = {
    battleId: "battle-1",
    opportunityId: "opp-001",
    warId: "war_1",
    areaId: BATTLE_AREA,
    missionType: "open_fleet_engagement",
    attackerId: ATTACKER_NATION,
    defenderId: DEFENDER_NATION,
    acceptanceClass: "accepted",
    missionObjectives: [] as string[],
    sides: [
      { sideId: "ATTACKER" as const, participantIds: [ATTACKER_NATION] },
      { sideId: "DEFENDER" as const, participantIds: [DEFENDER_NATION] },
    ],
    persistentAssets: [] as string[],
    temporaryAssets: [] as string[],
    permanentDivisionIds: [] as string[],
    tacticalDivisions: [] as never[],
    commanders: [] as string[],
    weather: "clear",
    seaState: "calm",
    visibility: "good",
    environment: "open_sea",
    sourceStateHashes: {} as Record<string, string>,
    reservations: [] as string[],
    autoResolutionProof: "auto-resolvable",
    provenanceRecords: [] as string[],
    rulesetVersion: "0.1.0",
    formulaVersion: "f1",
    aiPolicyVersion: "a1",
    rngVersion: "rng_v1",
    contentVersion: "fixture_v1",
    ...overrides,
  };
  return buildManifest(base);
}

export interface BattleSnapshotOptions {
  /** Ships per nation (default: 2 armed, in the battle area). */
  attackerShips?: Ship[];
  defenderShips?: Ship[];
  designs?: Map<string, CompiledDesignVersion>;
  wars?: WarDeclaration[];
  battles?: BattleInstance[];
  manifests?: BattleManifest[];
  /** Areas in world.areas — weather_generation commits strategic weather only
   *  for these (omit the battle area to exercise the missing-weather path). */
  areas?: string[];
  turnNumber?: number;
}

/**
 * Canonical 2-nation war snapshot for the battle_resolution phase tests.
 * Defaults: GBR/FRA each field 2 armed ships in `a-1` with compiled designs,
 * an ACTIVE war, an empty battle set (battle_generation fills it when the
 * ships are eligible), and `a-1` in the world so weather is committed.
 */
export function makeBattleSnapshot(opts: BattleSnapshotOptions = {}): CampaignSnapshot {
  const attackerShips = opts.attackerShips ?? [
    makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 200 }),
    makeShip("g2", "dv-att-b", ATTACKER_NATION, { firepower: 200 }),
  ];
  const defenderShips = opts.defenderShips ?? [
    makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: 200 }),
    makeShip("f2", "dv-def-b", DEFENDER_NATION, { firepower: 200 }),
  ];
  const designs =
    opts.designs ??
    new Map<string, CompiledDesignVersion>([
      ["dv-att-a", makeDesign("dv-att-a", ATTACKER_NATION)],
      ["dv-att-b", makeDesign("dv-att-b", ATTACKER_NATION)],
      ["dv-def-a", makeDesign("dv-def-a", DEFENDER_NATION)],
      ["dv-def-b", makeDesign("dv-def-b", DEFENDER_NATION)],
    ]);

  const slot: CampaignSlot = { nationId: ATTACKER_NATION, type: "playable" };
  return {
    version: "0.1.0",
    turnNumber: SafeInt(opts.turnNumber ?? 1),
    campaignId: "battle-resolution-phase-test",
    startYear: 1880,
    startMonth: 1,
    slots: [slot],
    world: {
      areas: (opts.areas ?? [BATTLE_AREA]).map((id) => ({ id, name: id, type: "sea" })),
      routes: [],
      ports: [],
    },
    nations: new Map<string, NationState>([
      [ATTACKER_NATION, makeNation(ATTACKER_NATION, attackerShips)],
      [DEFENDER_NATION, makeNation(DEFENDER_NATION, defenderShips)],
    ]),
    wars: {
      wars: opts.wars ?? [makeWar()],
      battles: opts.battles ?? [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: opts.manifests ?? [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs,
    designFamilies: new Map(),
    strategicWeather: [],
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "0.1.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
}
