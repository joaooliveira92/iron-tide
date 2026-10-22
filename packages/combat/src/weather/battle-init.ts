import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, drawUniform, type RandomLedger, type RandomStream } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import {
  type TimeOfDayState,
  weatherPolicyId,
  weatherComponentsPolicyId,
  WEATHER_RULESET_VERSION,
  WEATHER_FORMULA_VERSION,
  WEATHER_BATTLE_INITIALIZATION_PHASE,
  LOCAL_VARIATION_POLICY_NONE,
  LOCAL_VARIATION_POLICY_LIGHT,
  LOCAL_VARIATION_POLICIES,
  LOCAL_VARIATION_PRECIPITATION_INTENSITY_JITTER_BP,
  LOCAL_VARIATION_FOG_MIST_DENSITY_JITTER_BP,
  LOCAL_VARIATION_CLOUD_COVER_JITTER_BP,
  PRECIPITATION_INTENSITY_MIN_BP,
  PRECIPITATION_INTENSITY_MAX_BP,
  FOG_MIST_DENSITY_MIN_BP,
  FOG_MIST_DENSITY_MAX_BP,
  CLOUD_COVER_MIN_BP,
  CLOUD_COVER_MAX_BP,
} from "./constants.js";
import { INVALID_BATTLE_WEATHER_INITIALIZATION } from "./reasonCodes.js";
import { assertFixedPointStrategicWeather, type StrategicWeatherState } from "./strategic-state.js";
import { type BattleWeatherComponents, withTacticalWeatherComponentsHash } from "./components.js";

export interface BattleLocation {
  areaId: string;
  xUm: number;
  yUm: number;
}

export interface ResolvedSolarGeometry {
  timeOfDay: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
}

export interface BattleWeatherInitializationSeed {
  battleId: string;
  areaId: string;
  strategicWeatherState: StrategicWeatherState;
  battleDate: string;
  battleStartTime: string;
  location: BattleLocation;
  missionTemplateId: string;
  localVariationPolicyId: string;
  battleSeed: string;
  solarGeometry: ResolvedSolarGeometry;
  randomLedger?: RandomLedger;
}

export interface BattleWeatherInitialization {
  battleId: string;
  areaId: string;
  strategicWeatherStateHash: string;
  battleDate: string;
  battleStartTime: string;
  location: BattleLocation;
  missionTemplateId: string;
  localVariationPolicyId: string;
  weatherPolicyVersion: string;
  componentsVersion: string;
  rulesetVersion: string;
  components: BattleWeatherComponents;
  initializationHash: string;
}

export function sameStrategicWeatherSource(
  a: BattleWeatherInitialization,
  b: BattleWeatherInitialization,
): boolean {
  return (
    a.strategicWeatherStateHash !== "" &&
    a.strategicWeatherStateHash === b.strategicWeatherStateHash
  );
}

function initError(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_BATTLE_WEATHER_INITIALIZATION, {
    code: INVALID_BATTLE_WEATHER_INITIALIZATION,
    field,
    reason,
    value,
  });
}

function jitteredBp(
  stream: RandomStream,
  base: number,
  jitterBp: number,
  minBp: number,
  maxBp: number,
): { value: number; draw: number } {
  const draw = drawUniform(stream, SafeInt(0), SafeInt(2 * jitterBp)) as number;
  const delta = draw - jitterBp;
  const candidate = base + delta;
  return { value: Math.min(maxBp, Math.max(minBp, candidate)), draw };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== null && typeof v === "object") deepFreeze(v);
    }
  }
  return value;
}

export function initializeBattleWeather(
  seed: BattleWeatherInitializationSeed,
): BattleWeatherInitialization {
  assertFixedPointStrategicWeather(seed.strategicWeatherState);
  const strategic = seed.strategicWeatherState;

  if (!(LOCAL_VARIATION_POLICIES as readonly string[]).includes(seed.localVariationPolicyId)) {
    initError(
      "localVariationPolicyId",
      seed.localVariationPolicyId,
      "unknown local-variation policy — no silent fallback",
    );
  }
  if (!Number.isInteger(seed.location.xUm) || !Number.isInteger(seed.location.yUm)) {
    initError("location", seed.location, "location coordinates must be integer micrometres");
  }
  if (seed.areaId !== strategic.areaId) {
    initError(
      "areaId",
      seed.areaId,
      `battle area id '${seed.areaId}' must match the committed strategic weather source area '${strategic.areaId}'`,
    );
  }
  if (seed.location.areaId !== seed.areaId) {
    initError(
      "location.areaId",
      seed.location.areaId,
      `battle location area id must match the battle area id '${seed.areaId}'`,
    );
  }

  const ledgerEntityKey = `${seed.battleId}:${seed.areaId}`;
  const decisionsInputHash = sha256Hex(
    canonicalSerialize({
      battleId: seed.battleId,
      areaId: seed.areaId,
      strategicWeatherStateHash: strategic.stateHash,
      localVariationPolicyId: seed.localVariationPolicyId,
      battleSeed: seed.battleSeed,
    }),
  );
  const recordDraw = (
    streamId: string,
    draw: number,
    outcome: string,
    reasonCode: string,
  ): void => {
    if (!seed.randomLedger) return;
    seed.randomLedger.record({
      streamId,
      entityKey: ledgerEntityKey,
      phase: WEATHER_BATTLE_INITIALIZATION_PHASE,
      rulesetVersion: WEATHER_RULESET_VERSION,
      inputHash: decisionsInputHash,
      draw,
      outcome,
      reasonCode,
    });
  };

  let components: BattleWeatherComponents;
  if (seed.localVariationPolicyId === LOCAL_VARIATION_POLICY_NONE) {
    components = withTacticalWeatherComponentsHash({
      battleId: seed.battleId,
      seaState: strategic.seaState,
      windDirectionDeg: strategic.windDirectionDeg,
      windSpeedUmPerSec: strategic.windSpeedUmPerSec,
      precipitationType: strategic.precipitationType,
      precipitationIntensityBp: strategic.precipitationIntensityBp,
      fogMistDensityBp: strategic.fogMistDensityBp,
      cloudCoverBp: strategic.cloudCoverBp,
      timeOfDay: seed.solarGeometry.timeOfDay,
      solarBearingDeg: seed.solarGeometry.solarBearingDeg,
      solarElevationDeg: seed.solarGeometry.solarElevationDeg,
      glareIntensityBp: 0,
      baseVisibilityUm: strategic.baseVisibilityUm,
      localSmokeFields: [],
      rulesetVersion: WEATHER_RULESET_VERSION,
      formulaVersion: WEATHER_FORMULA_VERSION,
    });
  } else if (seed.localVariationPolicyId === LOCAL_VARIATION_POLICY_LIGHT) {
    const streamId = `battle/weather/${seed.battleId}/local_variation`;
    const stream = new RandomEngine(seed.battleSeed).stream(streamId);
    const jitteredPrecip = jitteredBp(
      stream,
      strategic.precipitationIntensityBp,
      LOCAL_VARIATION_PRECIPITATION_INTENSITY_JITTER_BP,
      PRECIPITATION_INTENSITY_MIN_BP,
      PRECIPITATION_INTENSITY_MAX_BP,
    );
    const jitteredFog = jitteredBp(
      stream,
      strategic.fogMistDensityBp,
      LOCAL_VARIATION_FOG_MIST_DENSITY_JITTER_BP,
      FOG_MIST_DENSITY_MIN_BP,
      FOG_MIST_DENSITY_MAX_BP,
    );
    const jitteredCloud = jitteredBp(
      stream,
      strategic.cloudCoverBp,
      LOCAL_VARIATION_CLOUD_COVER_JITTER_BP,
      CLOUD_COVER_MIN_BP,
      CLOUD_COVER_MAX_BP,
    );
    recordDraw(
      streamId,
      jitteredPrecip.draw,
      `precipitation_intensity_bp_${String(jitteredPrecip.value)}`,
      "PRECIPITATION_INTENSITY_JITTER",
    );
    recordDraw(
      streamId,
      jitteredFog.draw,
      `fog_mist_density_bp_${String(jitteredFog.value)}`,
      "FOG_MIST_DENSITY_JITTER",
    );
    recordDraw(
      streamId,
      jitteredCloud.draw,
      `cloud_cover_bp_${String(jitteredCloud.value)}`,
      "CLOUD_COVER_JITTER",
    );
    components = withTacticalWeatherComponentsHash({
      battleId: seed.battleId,
      seaState: strategic.seaState,
      windDirectionDeg: strategic.windDirectionDeg,
      windSpeedUmPerSec: strategic.windSpeedUmPerSec,
      precipitationType: strategic.precipitationType,
      precipitationIntensityBp: jitteredPrecip.value,
      fogMistDensityBp: jitteredFog.value,
      cloudCoverBp: jitteredCloud.value,
      timeOfDay: seed.solarGeometry.timeOfDay,
      solarBearingDeg: seed.solarGeometry.solarBearingDeg,
      solarElevationDeg: seed.solarGeometry.solarElevationDeg,
      glareIntensityBp: 0,
      baseVisibilityUm: strategic.baseVisibilityUm,
      localSmokeFields: [],
      rulesetVersion: WEATHER_RULESET_VERSION,
      formulaVersion: WEATHER_FORMULA_VERSION,
    });
  } else {
    initError(
      "localVariationPolicyId",
      seed.localVariationPolicyId,
      "no implemented variation path for policy",
    );
  }

  const base = {
    battleId: seed.battleId,
    areaId: seed.areaId,
    strategicWeatherStateHash: strategic.stateHash,
    battleDate: seed.battleDate,
    battleStartTime: seed.battleStartTime,
    location: {
      areaId: seed.location.areaId,
      xUm: seed.location.xUm,
      yUm: seed.location.yUm,
    },
    missionTemplateId: seed.missionTemplateId,
    localVariationPolicyId: seed.localVariationPolicyId,
    weatherPolicyVersion: weatherPolicyId,
    componentsVersion: weatherComponentsPolicyId,
    rulesetVersion: WEATHER_RULESET_VERSION,
    components,
  };

  const inputHash = sha256Hex(canonicalSerialize(base));
  const initializationHash = createEnvelope("battle-weather-initialization", weatherPolicyId, {
    ...base,
    inputHash,
  }).bodyHash;

  return deepFreeze({ ...base, initializationHash });
}
