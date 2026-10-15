//packages/combat/src/simulation/run-weather-child.ts
// Deterministic child-process script for B-5 weather determinism (AC-14).
// Spawned by determinism.test.ts; prints a single JSON line with per-minute
// hashes including weather events. Canonical weather input is built in-process
// from the B-2 fixture plus a minimal climate/daylight profile.
import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import type { TacticalBattleState, TacticalShipUnit } from "../tactical/index.js";
import type { MovementState } from "../movement.js";
import { computeInitialMovementStates } from "./spawn.js";
import { advanceMinutes } from "./engine.js";
import { withTacticalWeatherComponentsHash } from "../weather/components.js";
import type { WeatherEngineContext } from "../weather/engine.js";

function unit(id: string, sideId: "ATTACKER" | "DEFENDER", className: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className,
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre-1",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre-1",
      projectionReason: "child-process",
      persistenceDisposition: "persistent",
      provenanceHash: "prov-1",
    },
  };
}

const units: TacticalShipUnit[] = [
  unit("a1", "ATTACKER", "Battleship"),
  unit("a2", "ATTACKER", "Cruiser"),
  unit("d1", "DEFENDER", "Battleship"),
  unit("d2", "DEFENDER", "Cruiser"),
];

const movementStates: Record<string, MovementState> = computeInitialMovementStates(
  { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
  units.map((u) => ({
    assetId: u.assetId,
    sideId: u.sideId as "ATTACKER" | "DEFENDER",
    orderedSpeedBpKnots: 10_000,
    designedSpeedBpKnots: 20_000,
    turningRateMdegS: 1_000,
  })),
);

const state: TacticalBattleState = {
  battleId: "b5-weather-determinism",
  mapId: "eng_ch",
  sides: [
    { sideId: "ATTACKER", participantIds: ["a1", "a2"] },
    { sideId: "DEFENDER", participantIds: ["d1", "d2"] },
  ],
  forces: { ATTACKER: ["a1", "a2"], DEFENDER: ["d1", "d2"] },
  divisions: [],
  units,
  contacts: [],
  movementStates,
  objectives: [],
  weather: {
    weather: "clear",
    seaState: "calm",
    visibilityNm: 20,
    daylight: true,
  },
  exitZones: [],
  battleEventLedger: [],
};

const orders = {
  a1: { orderedHeading: 90, orderedSpeedBp: 20_000 },
  a2: { orderedHeading: 37, orderedSpeedBp: 20_000 },
  d1: { orderedHeading: 270, orderedSpeedBp: 20_000 },
  d2: { orderedHeading: 123, orderedSpeedBp: 20_000 },
};

// Minimal climate/daylight fixture (CONTENT-track deferred; test surface).
const daylightProfile = {
  daylightProfileId: "test_daylight_v1",
  entries: [
    {
      minuteOfDay: 0,
      state: "NIGHT" as const,
      solarBearingDeg: 0,
      solarElevationDeg: -30,
    },
    {
      minuteOfDay: 390,
      state: "DAY" as const,
      solarBearingDeg: 90,
      solarElevationDeg: 30,
    },
    {
      minuteOfDay: 720,
      state: "DAY" as const,
      solarBearingDeg: 180,
      solarElevationDeg: 60,
    },
    {
      minuteOfDay: 1200,
      state: "DAY" as const,
      solarBearingDeg: 250,
      solarElevationDeg: 20,
    },
    {
      minuteOfDay: 1440,
      state: "NIGHT" as const,
      solarBearingDeg: 0,
      solarElevationDeg: -30,
    },
  ],
};

const climateProfile = {
  climateProfileId: "test_climate_v1",
  climateVersion: "weather_climate_v1",
  seasonAssignment: { "0": "test" },
  seasons: [
    {
      seasonId: "test",
      seaStateRange: { min: 3, max: 3 },
      windBands: [{ bandId: "W", directionDeg: 270, weight: 1 }],
      windSpeedRangeUmPerSec: { min: 8_000_000, max: 8_000_000 },
      precipitationOptions: [
        {
          type: "NONE" as const,
          weight: 1,
          intensityRangeBp: { min: 0, max: 0 },
        },
      ],
      fogMistDensityRangeBp: { min: 500, max: 500 },
      cloudCoverRangeBp: { min: 5_000, max: 5_000 },
      daylightProfileId: "test_daylight_v1",
      glareEligible: false,
      baseVisibilityRangeUm: { min: 60_000_000_000, max: 60_000_000_000 },
    },
  ],
};

const weatherComponents = withTacticalWeatherComponentsHash({
  battleId: "b5-weather-determinism",
  seaState: 3,
  windDirectionDeg: 270,
  windSpeedUmPerSec: 8_000_000,
  precipitationType: "NONE",
  precipitationIntensityBp: 0,
  fogMistDensityBp: 500,
  cloudCoverBp: 5_000,
  timeOfDay: "DAY",
  solarBearingDeg: 180,
  solarElevationDeg: 60,
  glareIntensityBp: 0,
  baseVisibilityUm: 60_000_000_000,
  localSmokeFields: [],
  rulesetVersion: "weather_ruleset_v1",
  formulaVersion: "weather_formula_v1",
});

const weather: WeatherEngineContext = {
  components: weatherComponents,
  daylightProfile,
  climateProfile,
  seasonId: "test",
  battleStartMinutes: 720,
  battleSeed: "deterministic-seed",
};

async function main(): Promise<void> {
  const res = advanceMinutes({
    state,
    minutes: 3,
    observationTime: "1900-01-01T00:00:00.000Z",
    orders,
    weather,
  });

  const output = {
    minuteHashes: res.hashes,
    weatherEventCounts: res.results.map(
      (r) => r.events.filter((e) => e.eventType.startsWith("weather_")).length,
    ),
  };

  process.stdout.write(canonicalSerialize(output) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
