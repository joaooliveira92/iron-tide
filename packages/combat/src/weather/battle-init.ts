// DESIGN-42 §2 BattleWeatherInitialization (INC-2/AC-3): every battle creates
// exactly one immutable BattleWeatherInitialization from the area's committed
// strategic weather state, battle date/start time, battle location within the
// area, mission template, declared local-variation policy, battle seed, and the
// weather policy version. Battles in the same area and overlapping tactical
// time use the same strategic weather source state; local variation MAY differ
// only through a versioned keyed decision (UI navigation, reload, tactical-play
// choice, and auto-resolution choice never reroll weather). Pure/deterministic:
// no ambient I/O/clock/random; the only randomness enters through the battle
// seed via the keyed stream.
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

/** Battle location within the strategic area (canonical integer µm). */
export interface BattleLocation {
  areaId: string;
  xUm: number;
  yUm: number;
}

/** Resolved solar geometry for the battle's date/location/tactical time. The
 *  canonical derivation (DESIGN-42 §27) lives in the nightTwilight module
 *  (INC-4); initialization consumes the resolved geometry it produces. */
export interface ResolvedSolarGeometry {
  timeOfDay: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
}

export interface BattleWeatherInitializationSeed {
  battleId: string;
  /** Area the battle is fought in (battle location's area). */
  areaId: string;
  /** The committed strategic weather state for the area/month (source). */
  strategicWeatherState: StrategicWeatherState;
  /** Battle date identifier (e.g. "1880-06-15"). */
  battleDate: string;
  /** Battle start time identifier (e.g. "04:30"). */
  battleStartTime: string;
  /** Battle location within the area. */
  location: BattleLocation;
  /** Mission template identifier. */
  missionTemplateId: string;
  /** Declared local-variation policy (weather_local_variation_*_v1). */
  localVariationPolicyId: string;
  /** Battle seed: keyed variation stream derivation root. */
  battleSeed: string;
  /** Resolved solar geometry for battle date/location/start time. */
  solarGeometry: ResolvedSolarGeometry;
  /** Optional ledger recording every keyed random decision (port pattern; see
   *  ADR-0022 §10 — local-variation jitter draws). */
  randomLedger?: RandomLedger;
}

export interface BattleWeatherInitialization {
  battleId: string;
  areaId: string;
  /** Hash of the committed strategic source state (authoritative source id). */
  strategicWeatherStateHash: string;
  battleDate: string;
  battleStartTime: string;
  location: BattleLocation;
  missionTemplateId: string;
  localVariationPolicyId: string;
  weatherPolicyVersion: string;
  componentsVersion: string;
  rulesetVersion: string;
  /** Derived initial tactical components (after versioned keyed local variation). */
  components: BattleWeatherComponents;
  /** Authoritative initialization hash (deterministic). */
  initializationHash: string;
}

// §2: two initializations share the same strategic weather source when they come
// from the same committed strategic state (same area + month + state hash).
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

// Jitter helper: draw one uniform value in [0, 2*jitter], shift by -jitter so
// the result lands in [-jitter, +jitter], clamp to the component bounds, and
// return an integer basis-point delta plus the raw draw (for the RandomLedger).
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

// AC-3: build the one immutable BattleWeatherInitialization for a battle.
export function initializeBattleWeather(
  seed: BattleWeatherInitializationSeed,
): BattleWeatherInitialization {
  // The committed strategic source MUST be authoritative before derivation.
  assertFixedPointStrategicWeather(seed.strategicWeatherState);
  const strategic = seed.strategicWeatherState;

  // Initialization-boundary failures — unknown policy, malformed location, or
  // an area mismatch between the battle declaration, the location, and the
  // committed strategic source — fail with INVALID_BATTLE_WEATHER_INITIALIZATION
  // (M5), never a generic invariant code.
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

  // Deterministic decision identity for the optional RandomLedger (M6).
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

  // Versioned keyed local-variation decision. With the NONE policy the keyed
  // stream is not consumed at all: components copy the strategic state exactly.
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
      glareIntensityBp: 0, // no resolved directional geometry at initialization
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
    // Unreachable: LOCAL_VARIATION_POLICIES membership checked above.
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
