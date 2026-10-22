import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion, Ship } from "@bluewave/campaign";
import { buildManifest, type BattleManifest } from "@bluewave/combat/generation";
import {
  withStrategicWeatherStateHash,
  type StrategicWeatherState,
} from "@bluewave/combat/weather";
import type { AutoResolverNation } from "@bluewave/combat/battleResolution";
import type { ResolveBattleAutoInput } from "@bluewave/combat/battleResolution";

export const BATTLE_ID = "b6-inc2-battle-001";
export const WAR_ID = "war-001";
export const AREA_ID = "area-eng-ch";
export const CAMPAIGN_MONTH = "1880-06";
export const ATTACKER_NATION = "n-uk";
export const DEFENDER_NATION = "n-fr";
export const CAMPAIGN_SEED = "campaign-seed-b6-inc2-fixed";
export const OPPORTUNITY_ID = "opp-001";
export const DESIGN_ATT_A = "dv-att-a";
export const DESIGN_ATT_B = "dv-att-b";
export const DESIGN_DEF_A = "dv-def-a";
export const DESIGN_DEF_B = "dv-def-b";
export const DESIGN_UNARMED = "dv-unarmed";
export const DESIGN_UNDER_CONSTRUCTION = "dv-uc";

const UMS_PER_KNOT = 514_444;

function design(
  designVersionId: string,
  nationId: string,
  opts: {
    hullType?: string;
    guns?: number;
    caliberUm?: number;
    armorUm?: number;
    speedKnots?: number;
  } = {},
): CompiledDesignVersion {
  const guns = opts.guns ?? 10;
  const speedUms = Math.floor((opts.speedKnots ?? 30) * UMS_PER_KNOT);
  return {
    designVersionId,
    designFamilyId: `${designVersionId}-family`,
    className: `Class ${designVersionId}`,
    nationId,
    hullType: opts.hullType ?? "battleship",
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

function ship(
  id: string,
  designVersionId: string,
  nationId: string,
  overrides: Partial<Ship> = {},
): Ship {
  return {
    id,
    name: id,
    classId: designVersionId,
    nationId,
    locationAreaId: AREA_ID,
    designVersionId,
    hitPoints: SafeInt((overrides.hitPoints as number) ?? 100),
    maxHitPoints: SafeInt((overrides.maxHitPoints as number) ?? 100),
    speed: SafeInt(30),
    firepower: SafeInt(10),
    armor: SafeInt(12),
    isUnderConstruction: overrides.isUnderConstruction ?? false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...overrides,
  };
}

function strategicWeather(overrides: Partial<StrategicWeatherState> = {}): StrategicWeatherState {
  return withStrategicWeatherStateHash({
    areaId: AREA_ID,
    month: CAMPAIGN_MONTH,
    climateProfileId: "default",
    seasonId: "summer",
    persistentWeatherStateId: "",
    seaState: 3,
    windDirectionDeg: 225,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 500,
    cloudCoverBp: 5_000,
    daylightProfileId: "default_daylight_v1",
    glareEligible: true,
    baseVisibilityUm: 60_000_000_000,
    generatedAtPhase: "weather_generation",
    rulesetVersion: "weather_ruleset_v1",
    climateVersion: "weather_climate_v1",
    formulaVersion: "weather_formula_v1",
    rngVersion: "weather_rng_v1",
    ...overrides,
  });
}

export interface FixtureNationSet {
  attacker: AutoResolverNation;
  defender: AutoResolverNation;
  attackerDesigns: Map<string, CompiledDesignVersion>;
  defenderDesigns: Map<string, CompiledDesignVersion>;
  attackerShips: Ship[];
  defenderShips: Ship[];
}

export function makeNations(
  opts: {
    attackerGuns?: number[];
    defenderGuns?: number[];
    attackerIncludesUnarmed?: boolean;
    defenderIncludesUnarmed?: boolean;
    attackerUnderConstruction?: string[];
    defenderUnderConstruction?: string[];
  } = {},
): FixtureNationSet {
  const attackerGuns = opts.attackerGuns ?? [10, 10];
  const defenderGuns = opts.defenderGuns ?? [10, 10];

  const attackerShips: Ship[] = [
    ship("a1", DESIGN_ATT_A, ATTACKER_NATION),
    ship("a2", DESIGN_ATT_B, ATTACKER_NATION),
  ];
  if (opts.attackerIncludesUnarmed)
    attackerShips.push(ship("a3", DESIGN_UNARMED, ATTACKER_NATION, { firepower: SafeInt(0) }));
  for (const id of opts.attackerUnderConstruction ?? []) {
    attackerShips.push(
      ship(id, DESIGN_UNDER_CONSTRUCTION, ATTACKER_NATION, { isUnderConstruction: true }),
    );
  }

  const defenderShips: Ship[] = [
    ship("d1", DESIGN_DEF_A, DEFENDER_NATION),
    ship("d2", DESIGN_DEF_B, DEFENDER_NATION),
  ];
  if (opts.defenderIncludesUnarmed)
    defenderShips.push(ship("d3", DESIGN_UNARMED, DEFENDER_NATION, { firepower: SafeInt(0) }));
  for (const id of opts.defenderUnderConstruction ?? []) {
    defenderShips.push(
      ship(id, DESIGN_UNDER_CONSTRUCTION, DEFENDER_NATION, { isUnderConstruction: true }),
    );
  }

  const attackerDesigns = new Map<string, CompiledDesignVersion>([
    [DESIGN_ATT_A, design(DESIGN_ATT_A, ATTACKER_NATION, { guns: attackerGuns[0] })],
    [DESIGN_ATT_B, design(DESIGN_ATT_B, ATTACKER_NATION, { guns: attackerGuns[1] })],
    [
      DESIGN_UNARMED,
      design(DESIGN_UNARMED, ATTACKER_NATION, { hullType: "destroyer", guns: 0, caliberUm: 0 }),
    ],
    [DESIGN_UNDER_CONSTRUCTION, design(DESIGN_UNDER_CONSTRUCTION, ATTACKER_NATION)],
  ]);
  const defenderDesigns = new Map<string, CompiledDesignVersion>([
    [DESIGN_DEF_A, design(DESIGN_DEF_A, DEFENDER_NATION, { guns: defenderGuns[0] })],
    [DESIGN_DEF_B, design(DESIGN_DEF_B, DEFENDER_NATION, { guns: defenderGuns[1] })],
    [
      DESIGN_UNARMED,
      design(DESIGN_UNARMED, DEFENDER_NATION, { hullType: "destroyer", guns: 0, caliberUm: 0 }),
    ],
    [DESIGN_UNDER_CONSTRUCTION, design(DESIGN_UNDER_CONSTRUCTION, DEFENDER_NATION)],
  ]);

  return {
    attacker: {
      nationId: ATTACKER_NATION,
      ships: attackerShips,
      designs: attackerDesigns,
      divisions: [],
    },
    defender: {
      nationId: DEFENDER_NATION,
      ships: defenderShips,
      designs: defenderDesigns,
      divisions: [],
    },
    attackerDesigns,
    defenderDesigns,
    attackerShips,
    defenderShips,
  };
}

export function makeManifest(overrides: Partial<BattleManifest> = {}): BattleManifest {
  return buildManifest({
    battleId: BATTLE_ID,
    opportunityId: OPPORTUNITY_ID,
    warId: WAR_ID,
    areaId: AREA_ID,
    missionType: "open_fleet_engagement",
    attackerId: ATTACKER_NATION,
    defenderId: DEFENDER_NATION,
    acceptanceClass: "accepted",
    missionObjectives: [],
    sides: [
      { sideId: "ATTACKER", participantIds: [ATTACKER_NATION] },
      { sideId: "DEFENDER", participantIds: [DEFENDER_NATION] },
    ],
    persistentAssets: ["a1", "a2", "d1", "d2"],
    temporaryAssets: [],
    permanentDivisionIds: [],
    tacticalDivisions: [],
    commanders: [],
    weather: "clear",
    seaState: "calm",
    visibility: "good",
    environment: "open_sea",
    sourceStateHashes: {},
    reservations: [],
    autoResolutionProof: "auto-resolvable",
    provenanceRecords: [],
    rulesetVersion: "b6_ruleset_v1",
    formulaVersion: "b6_formula_v1",
    aiPolicyVersion: "ai_policy_v1",
    rngVersion: "rng_v1",
    contentVersion: "fixture_v1",
    ...overrides,
  });
}

export function makeAutoInput(
  opts: {
    nations?: FixtureNationSet;
    manifest?: BattleManifest;
    strategicWeather?: StrategicWeatherState;
    maxMinutes?: number;
    battleId?: string;
    areaId?: string;
  } = {},
): ResolveBattleAutoInput {
  const nations = opts.nations ?? makeNations();
  return {
    battleId: opts.battleId ?? BATTLE_ID,
    areaId: opts.areaId ?? AREA_ID,
    campaignMonth: CAMPAIGN_MONTH,
    manifest: opts.manifest ?? makeManifest(),
    attacker: nations.attacker,
    defender: nations.defender,
    strategicWeather: opts.strategicWeather ?? strategicWeather(),
    campaignSeed: CAMPAIGN_SEED,
    rulesetVersion: "b6_ruleset_v1",
    formulaVersion: "b6_formula_v1",
    rngVersion: "rng_v1",
    maxMinutes: opts.maxMinutes,
  };
}

export function makeProjectionManifest(assets: string[]): BattleManifest {
  return makeManifest({ persistentAssets: [...assets] });
}
