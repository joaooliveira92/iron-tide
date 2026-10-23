import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import type { CompiledDesignVersion, Ship } from "@bluewave/campaign";
import { buildManifest, type BattleManifest } from "../src/generation/manifest.js";
import { withStrategicWeatherStateHash } from "../src/weather/strategic-state.js";
import { resolveBattleAuto, type ResolveBattleAutoInput } from "../src/battleResolution/resolve.js";
import type { AutoResolverNation } from "../src/battleResolution/project.js";

const ATTACKER = "n-uk";
const DEFENDER = "n-fr";

const WHITEHEAD_14IN: CompiledTorpedo = {
  partId: "whitehead_14in_1886",
  revision: "1884-01",
  diameterUm: 356_000,
  massKg: 300,
  warheadType: "WET_GUNCOTTON",
  warheadExplosiveMassKg: 27,
  warheadExplosiveEquivalentMassKg: 27,
  propulsionType: "COMPRESSED_AIR",
  speedSettings: [{ settingId: "25kn", speedMilliKnots: 25_000, rangeM: 550 }],
  minimumArmingDistanceM: 25,
  reliabilityBp: 88_000,
  guidanceCapability: "none",
  launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"],
  technologyPrerequisiteIds: [],
  tubeHitHazardPolicy: "ORDINARY",
};

function design(designVersionId: string, nationId: string): CompiledDesignVersion {
  return {
    designVersionId,
    designFamilyId: `${designVersionId}-family`,
    className: `Class ${designVersionId}`,
    nationId,
    hullType: "battleship",
    normalizedDisplacementKg: SafeInt(30_000_000),
    normalizedSpeedUms: SafeInt(15_433_320),
    normalizedArmorUm: SafeInt(305_000),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    machineryType: "steam_triple_expansion",
    crewComplement: SafeInt(1_000),
    contentVersion: "fixture_v1",
    compiledHash: `compiled-${designVersionId}`,
  };
}

function ship(id: string, designVersionId: string, nationId: string): Ship {
  return {
    id,
    name: id,
    classId: designVersionId,
    nationId,
    locationAreaId: "area-eng-ch",
    designVersionId,
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(30),
    firepower: SafeInt(10),
    armor: SafeInt(12),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
  };
}

function nation(nationId: string, shipIds: string[]): AutoResolverNation {
  const designs = new Map<string, CompiledDesignVersion>();
  for (const id of shipIds) designs.set(id, design(id, nationId));
  return {
    nationId,
    ships: shipIds.map((id) => ship(id, id, nationId)),
    designs,
    divisions: [],
  };
}

function manifest(): BattleManifest {
  return buildManifest({
    battleId: "b6-child-battle",
    opportunityId: "opp-child",
    warId: "war-child",
    areaId: "area-eng-ch",
    missionType: "open_fleet_engagement",
    attackerId: ATTACKER,
    defenderId: DEFENDER,
    acceptanceClass: "accepted",
    missionObjectives: [],
    sides: [
      { sideId: "ATTACKER", participantIds: [ATTACKER] },
      { sideId: "DEFENDER", participantIds: [DEFENDER] },
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
  });
}

const input: ResolveBattleAutoInput = {
  battleId: "b6-child-battle",
  areaId: "area-eng-ch",
  campaignMonth: "1880-06",
  manifest: manifest(),
  attacker: nation(ATTACKER, ["a1", "a2"]),
  defender: nation(DEFENDER, ["d1", "d2"]),
  strategicWeather: withStrategicWeatherStateHash({
    areaId: "area-eng-ch",
    month: "1880-06",
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
  }),
  campaignSeed: "child-campaign-seed-b6-fixed",
  rulesetVersion: "b6_ruleset_v1",
  formulaVersion: "b6_formula_v1",
  rngVersion: "rng_v1",
};

function armedIronclads(designs: Map<string, CompiledDesignVersion>) {
  return new Map(
    [...designs].map(([id, d]) => [
      id,
      {
        ...d,
        normalizedSpeedUms: SafeInt(14 * 514_444),
        normalizedDisplacementKg: SafeInt(11_000_000),
        mainGunsCount: SafeInt(4),
        torpedoArmament: [
          {
            mountType: "UNDERWATER_FIXED",
            tubeCount: SafeInt(2),
            torpedoModelId: "whitehead_14in_1886",
            compiledTorpedo: WHITEHEAD_14IN,
          },
          {
            mountType: "ABOVE_WATER_TRAINABLE",
            tubeCount: SafeInt(2),
            torpedoModelId: "whitehead_14in_1886",
            compiledTorpedo: WHITEHEAD_14IN,
          },
        ],
      },
    ]),
  );
}

function main(): void {
  const result = resolveBattleAuto(input);
  const torpedoRuns = ["s1", "s2", "s3", "s4", "s5"].map((seed) => {
    const r = resolveBattleAuto({
      ...input,
      campaignSeed: seed,
      attacker: { ...input.attacker, designs: armedIronclads(input.attacker.designs) },
      defender: { ...input.defender, designs: armedIronclads(input.defender.designs) },
    });
    return { seed, resultHash: r.resultHash, torpedoSummary: r.torpedoSummary ?? null };
  });
  const out = {
    resultHash: result.resultHash,
    battleEndReason: result.battleEndReason,
    elapsedMinutes: result.elapsedMinutes,
    winnerId: result.winnerId,
    loserId: result.loserId,
    eventLedgerHash: result.eventLedgerHash,
    minuteHashes: result.minuteHashes,
    damageReport: result.damageReport,
    survivorSunk: {
      attackerSurvivorIds: result.attackerSurvivorIds,
      defenderSurvivorIds: result.defenderSurvivorIds,
      attackerSunkIds: result.attackerSunkIds,
      defenderSunkIds: result.defenderSunkIds,
    },
    torpedoRuns,
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

try {
  main();
} catch (e) {
  process.stderr.write(`CHILD_FAILED: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
