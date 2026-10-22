import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine, drawUniform, type RandomLedger, type RandomStream } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  TACTICAL_WEATHER_PROGRESSION_INTERVAL_MINUTES,
  SEA_STATE_MIN,
  SEA_STATE_MAX,
  PRECIPITATION_INTENSITY_MIN_BP,
  PRECIPITATION_INTENSITY_MAX_BP,
  FOG_MIST_DENSITY_MIN_BP,
  FOG_MIST_DENSITY_MAX_BP,
  CLOUD_COVER_MIN_BP,
  CLOUD_COVER_MAX_BP,
  WEATHER_RULESET_VERSION,
  WEATHER_TACTICAL_PROGRESSION_PHASE,
  type PrecipitationType,
} from "./constants.js";
import { type BattleWeatherComponents, withTacticalWeatherComponentsHash } from "./components.js";
import {
  type ClimateProfile,
  type SeasonClimateProfile,
  type IntegerRange,
  validateSeasonTransitionTables,
} from "./climate.js";
import { WEATHER_PROFILE_INCOMPLETE } from "./reasonCodes.js";

export interface WeatherTransitionRecord {
  tacticalMinute: number;
  intervalIndex: number;
  component: string;
  preValue: string;
  postValue: string;
  reason: string;
}

function drawWeightedIndex(stream: RandomStream, weights: number[]): number {
  if (weights.length === 0) return -1;
  let total = 0;
  for (const w of weights) total += w;
  const scaled = stream.next() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!;
    if (scaled <= cumulative) return i;
  }
  return weights.length - 1;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function applyDrift(
  stream: RandomStream,
  base: number,
  driftRange: IntegerRange | undefined,
  absMin: number,
  absMax: number,
  maxAbsDelta?: number,
): { value: number; driftDraw: number } {
  if (driftRange === undefined) return { value: base, driftDraw: 0 };
  const drift = drawUniform(stream, SafeInt(driftRange.min), SafeInt(driftRange.max)) as number;
  const delta = maxAbsDelta === undefined ? drift : clamp(drift, -maxAbsDelta, maxAbsDelta);
  return { value: clamp(base + delta, absMin, absMax), driftDraw: drift };
}

function applyPrecipTransition(
  stream: RandomStream,
  currentType: string,
  precipTransitions:
    | Record<
        string,
        readonly {
          type: PrecipitationType;
          weight: number;
          intensityDriftRangeBp: IntegerRange;
        }[]
      >
    | undefined,
): {
  type: PrecipitationType;
  intensityDriftBp: number;
  typeIndex: number;
  driftDraw: number;
} | null {
  if (!precipTransitions || !precipTransitions[currentType]) return null;
  const opts = precipTransitions[currentType]!;
  const typeIndex = drawWeightedIndex(
    stream,
    opts.map((o) => o.weight),
  );
  if (typeIndex < 0) return null;
  const chosen = opts[typeIndex]!;
  const driftDraw = drawUniform(
    stream,
    SafeInt(chosen.intensityDriftRangeBp.min),
    SafeInt(chosen.intensityDriftRangeBp.max),
  ) as number;
  return {
    type: chosen.type,
    intensityDriftBp: driftDraw,
    typeIndex,
    driftDraw,
  };
}

function applyWindTransition(
  stream: RandomStream,
  currentBandId: string,
  bands: readonly { bandId: string; directionDeg: number }[],
  windTransitions: Record<string, { reachableBandIds: string[]; weights: number[] }> | undefined,
): { bandId: string; directionDeg: number; bandIndex: number } | null {
  if (!windTransitions || !windTransitions[currentBandId]) return null;
  const entry = windTransitions[currentBandId]!;
  const idx = drawWeightedIndex(stream, entry.weights);
  if (idx < 0) return null;
  const nextBandId = entry.reachableBandIds[idx];
  if (nextBandId === undefined) return null;
  const band = bands.find((b) => b.bandId === nextBandId);
  if (!band) return null;
  return {
    bandId: band.bandId,
    directionDeg: band.directionDeg,
    bandIndex: idx,
  };
}

export interface ProgressWeatherInput {
  components: BattleWeatherComponents;
  climateProfile: ClimateProfile;
  seasonId: string;
  tacticalMinute: number;
  battleSeed: string;
  randomLedger?: RandomLedger;
}

export interface ProgressWeatherResult {
  nextComponents: BattleWeatherComponents;
  transitions: WeatherTransitionRecord[];
}

export function progressBattleWeatherComponents(
  input: ProgressWeatherInput,
): ProgressWeatherResult {
  const { components, climateProfile, seasonId, tacticalMinute, battleSeed } = input;
  const intervalIndex = Math.floor(tacticalMinute / TACTICAL_WEATHER_PROGRESSION_INTERVAL_MINUTES);

  const season = climateProfile.seasons.find((s) => s.seasonId === seasonId) as
    | SeasonClimateProfile
    | undefined;
  if (!season) {
    throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
      code: WEATHER_PROFILE_INCOMPLETE,
      climateProfileId: climateProfile.climateProfileId,
      seasonId,
      reason: `season ${seasonId} not declared in climate profile`,
    });
  }
  validateSeasonTransitionTables(season, climateProfile.climateProfileId, seasonId);

  const streamId = `battle/weather/interval/${String(intervalIndex)}`;
  const stream = new RandomEngine(battleSeed).stream(streamId);

  const ledgerEntityKey = `${components.battleId}:${String(intervalIndex)}`;
  const inputHash = sha256Hex(
    canonicalSerialize({
      battleId: components.battleId,
      intervalIndex,
      tacticalMinute,
      climateProfileId: climateProfile.climateProfileId,
      seasonId,
      preStateHash: components.stateHash,
      battleSeed,
    }),
  );
  const recordDraw = (draw: number, outcome: string, reasonCode: string): void => {
    if (!input.randomLedger) return;
    input.randomLedger.record({
      streamId,
      entityKey: ledgerEntityKey,
      phase: WEATHER_TACTICAL_PROGRESSION_PHASE,
      rulesetVersion: WEATHER_RULESET_VERSION,
      inputHash,
      draw,
      outcome,
      reasonCode,
    });
  };

  let nextSeaState = components.seaState;
  if (season.seaStateDriftRange) {
    const driftResult = applyDrift(
      stream,
      components.seaState,
      season.seaStateDriftRange,
      SEA_STATE_MIN,
      SEA_STATE_MAX,
      1,
    );
    nextSeaState = driftResult.value;
    recordDraw(driftResult.driftDraw, `sea_state_${String(nextSeaState)}`, "SEA_STATE_DRIFT_DRAW");
  }

  let nextPrecipType = components.precipitationType;
  let nextPrecipIntensity = components.precipitationIntensityBp;
  if (season.precipitationTransitions) {
    const result = applyPrecipTransition(
      stream,
      components.precipitationType,
      season.precipitationTransitions,
    );
    if (result) {
      nextPrecipType = result.type;
      nextPrecipIntensity = clamp(
        components.precipitationIntensityBp + result.intensityDriftBp,
        PRECIPITATION_INTENSITY_MIN_BP,
        PRECIPITATION_INTENSITY_MAX_BP,
      );
      recordDraw(result.typeIndex, `precipitation_type_${result.type}`, "PRECIPITATION_TYPE_DRAW");
      recordDraw(
        result.driftDraw,
        `precipitation_intensity_bp_${String(nextPrecipIntensity)}`,
        "PRECIPITATION_INTENSITY_DRAW",
      );
    }
  }

  let nextWindDirectionDeg = components.windDirectionDeg;
  if (season.windTransitions) {
    const currentBand = season.windBands.find(
      (b) => b.directionDeg === components.windDirectionDeg,
    );
    if (currentBand) {
      const result = applyWindTransition(
        stream,
        currentBand.bandId,
        season.windBands,
        season.windTransitions,
      );
      if (result) {
        nextWindDirectionDeg = result.directionDeg;
        recordDraw(result.bandIndex, `wind_band_${result.bandId}`, "WIND_BAND_DRAW");
      }
    }
  }

  let nextWindSpeed = components.windSpeedUmPerSec;
  if (season.windSpeedDriftRangeUmPerSec) {
    const driftResult = applyDrift(
      stream,
      components.windSpeedUmPerSec,
      season.windSpeedDriftRangeUmPerSec,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    nextWindSpeed = driftResult.value;
    recordDraw(driftResult.driftDraw, `wind_speed_ums_${String(nextWindSpeed)}`, "WIND_SPEED_DRAW");
  }

  let nextFog = components.fogMistDensityBp;
  if (season.fogDriftRangeBp) {
    const driftResult = applyDrift(
      stream,
      components.fogMistDensityBp,
      season.fogDriftRangeBp,
      FOG_MIST_DENSITY_MIN_BP,
      FOG_MIST_DENSITY_MAX_BP,
    );
    nextFog = driftResult.value;
    recordDraw(
      driftResult.driftDraw,
      `fog_mist_density_bp_${String(nextFog)}`,
      "FOG_MIST_DENSITY_DRAW",
    );
  }

  let nextCloud = components.cloudCoverBp;
  if (season.cloudDriftRangeBp) {
    const driftResult = applyDrift(
      stream,
      components.cloudCoverBp,
      season.cloudDriftRangeBp,
      CLOUD_COVER_MIN_BP,
      CLOUD_COVER_MAX_BP,
    );
    nextCloud = driftResult.value;
    recordDraw(driftResult.driftDraw, `cloud_cover_bp_${String(nextCloud)}`, "CLOUD_COVER_DRAW");
  }

  let nextVisibility = components.baseVisibilityUm;
  if (season.visibilityDriftRangeUm) {
    const driftResult = applyDrift(
      stream,
      components.baseVisibilityUm,
      season.visibilityDriftRangeUm,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    nextVisibility = driftResult.value;
    recordDraw(
      driftResult.driftDraw,
      `base_visibility_um_${String(nextVisibility)}`,
      "BASE_VISIBILITY_DRAW",
    );
  }

  const nextComponents = withTacticalWeatherComponentsHash({
    ...components,
    seaState: nextSeaState,
    precipitationType: nextPrecipType,
    precipitationIntensityBp: nextPrecipIntensity,
    windDirectionDeg: nextWindDirectionDeg,
    windSpeedUmPerSec: nextWindSpeed,
    fogMistDensityBp: nextFog,
    cloudCoverBp: nextCloud,
    baseVisibilityUm: nextVisibility,
  });

  const transitions: WeatherTransitionRecord[] = [];
  const recordTransition = (
    comp: string,
    pre: number | string,
    post: number | string,
    reason: string,
  ) => {
    transitions.push({
      tacticalMinute,
      intervalIndex,
      component: comp,
      preValue: String(pre),
      postValue: String(post),
      reason,
    });
  };
  if (nextSeaState !== components.seaState)
    recordTransition("seaState", components.seaState, nextSeaState, "sea_state_drift");
  if (
    nextPrecipType !== components.precipitationType ||
    nextPrecipIntensity !== components.precipitationIntensityBp
  ) {
    recordTransition(
      "precipitation",
      `${components.precipitationType}/${String(components.precipitationIntensityBp)}`,
      `${nextPrecipType}/${String(nextPrecipIntensity)}`,
      "precipitation_transition",
    );
  }
  if (nextWindDirectionDeg !== components.windDirectionDeg) {
    recordTransition(
      "windDirectionDeg",
      components.windDirectionDeg,
      nextWindDirectionDeg,
      "wind_band_transition",
    );
  }
  if (nextWindSpeed !== components.windSpeedUmPerSec) {
    recordTransition(
      "windSpeedUmPerSec",
      components.windSpeedUmPerSec,
      nextWindSpeed,
      "wind_speed_drift",
    );
  }
  if (nextFog !== components.fogMistDensityBp)
    recordTransition("fogMistDensityBp", components.fogMistDensityBp, nextFog, "fog_drift");
  if (nextCloud !== components.cloudCoverBp)
    recordTransition("cloudCoverBp", components.cloudCoverBp, nextCloud, "cloud_drift");
  if (nextVisibility !== components.baseVisibilityUm)
    recordTransition(
      "baseVisibilityUm",
      components.baseVisibilityUm,
      nextVisibility,
      "visibility_drift",
    );

  return { nextComponents, transitions };
}
