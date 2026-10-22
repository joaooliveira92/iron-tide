import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  PRECIPITATION_TYPES,
  type PrecipitationType,
  weatherPolicyId,
  WEATHER_GENERATION_PHASE,
  SEA_STATE_MIN,
  SEA_STATE_MAX,
  WIND_DIRECTION_MIN_DEG,
  WIND_DIRECTION_MAX_DEG,
  PRECIPITATION_INTENSITY_MIN_BP,
  PRECIPITATION_INTENSITY_MAX_BP,
  FOG_MIST_DENSITY_MIN_BP,
  FOG_MIST_DENSITY_MAX_BP,
  CLOUD_COVER_MIN_BP,
  CLOUD_COVER_MAX_BP,
} from "./constants.js";
import { INVALID_STRATEGIC_WEATHER_STATE, WEATHER_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export interface StrategicWeatherState {
  areaId: string;
  month: string;
  climateProfileId: string;
  seasonId: string;
  persistentWeatherStateId: string;
  seaState: number;
  windDirectionDeg: number;
  windSpeedUmPerSec: number;
  precipitationType: PrecipitationType;
  precipitationIntensityBp: number;
  fogMistDensityBp: number;
  cloudCoverBp: number;
  daylightProfileId: string;
  glareEligible: boolean;
  baseVisibilityUm: number;
  generatedAtPhase: string;
  rulesetVersion: string;
  climateVersion: string;
  formulaVersion: string;
  rngVersion: string;
  stateHash: string;
}

function typeError(s: StrategicWeatherState, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_STRATEGIC_WEATHER_STATE, {
    code: INVALID_STRATEGIC_WEATHER_STATE,
    field,
    reason,
    value,
  });
}

function invariantError(
  s: StrategicWeatherState,
  field: string,
  value: unknown,
  reason: string,
): never {
  throw new BluewaveError(WEATHER_STATE_INVARIANT_FAILED, {
    code: WEATHER_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function requireString(
  s: StrategicWeatherState,
  field: string,
  value: unknown,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    typeError(s, field, value, `${field} must be a non-empty string`);
  }
}

function requireInteger(
  s: StrategicWeatherState,
  field: string,
  value: unknown,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    typeError(s, field, value, `${field} must be an integer`);
  }
  if (value < min || value > max) {
    invariantError(s, field, value, `${field} must be within [${min}, ${max}]`);
  }
}

function requireNonNegativeInteger(
  s: StrategicWeatherState,
  field: string,
  value: unknown,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    typeError(s, field, value, `${field} must be an integer`);
  }
  if (value < 0) {
    invariantError(s, field, value, `${field} must be non-negative`);
  }
}

export function assertFixedPointStrategicWeather(s: StrategicWeatherState): void {
  requireString(s, "areaId", s.areaId);
  requireString(s, "month", s.month);
  requireString(s, "climateProfileId", s.climateProfileId);
  requireString(s, "seasonId", s.seasonId);
  if (typeof s.persistentWeatherStateId !== "string") {
    typeError(s, "persistentWeatherStateId", s.persistentWeatherStateId, "must be a string");
  }

  requireInteger(s, "seaState", s.seaState, SEA_STATE_MIN, SEA_STATE_MAX);
  requireInteger(
    s,
    "windDirectionDeg",
    s.windDirectionDeg,
    WIND_DIRECTION_MIN_DEG,
    WIND_DIRECTION_MAX_DEG,
  );
  requireNonNegativeInteger(s, "windSpeedUmPerSec", s.windSpeedUmPerSec);

  if (!(PRECIPITATION_TYPES as readonly string[]).includes(s.precipitationType)) {
    invariantError(
      s,
      "precipitationType",
      s.precipitationType,
      "must be a canonical precipitation type",
    );
  }
  requireInteger(
    s,
    "precipitationIntensityBp",
    s.precipitationIntensityBp,
    PRECIPITATION_INTENSITY_MIN_BP,
    PRECIPITATION_INTENSITY_MAX_BP,
  );
  requireInteger(
    s,
    "fogMistDensityBp",
    s.fogMistDensityBp,
    FOG_MIST_DENSITY_MIN_BP,
    FOG_MIST_DENSITY_MAX_BP,
  );
  requireInteger(s, "cloudCoverBp", s.cloudCoverBp, CLOUD_COVER_MIN_BP, CLOUD_COVER_MAX_BP);

  requireString(s, "daylightProfileId", s.daylightProfileId);
  if (typeof s.glareEligible !== "boolean") {
    typeError(s, "glareEligible", s.glareEligible, "glareEligible must be a boolean");
  }
  requireNonNegativeInteger(s, "baseVisibilityUm", s.baseVisibilityUm);

  requireString(s, "generatedAtPhase", s.generatedAtPhase);
  if (s.generatedAtPhase !== WEATHER_GENERATION_PHASE) {
    invariantError(
      s,
      "generatedAtPhase",
      s.generatedAtPhase,
      "generatedAtPhase must be weather_generation",
    );
  }
  requireString(s, "rulesetVersion", s.rulesetVersion);
  requireString(s, "climateVersion", s.climateVersion);
  requireString(s, "formulaVersion", s.formulaVersion);
  requireString(s, "rngVersion", s.rngVersion);
}

export function computeStrategicWeatherStateHash(s: StrategicWeatherState): string {
  const surface = {
    areaId: s.areaId,
    month: s.month,
    climateProfileId: s.climateProfileId,
    seasonId: s.seasonId,
    persistentWeatherStateId: s.persistentWeatherStateId,
    seaState: s.seaState,
    windDirectionDeg: s.windDirectionDeg,
    windSpeedUmPerSec: s.windSpeedUmPerSec,
    precipitationType: s.precipitationType,
    precipitationIntensityBp: s.precipitationIntensityBp,
    fogMistDensityBp: s.fogMistDensityBp,
    cloudCoverBp: s.cloudCoverBp,
    daylightProfileId: s.daylightProfileId,
    glareEligible: s.glareEligible,
    baseVisibilityUm: s.baseVisibilityUm,
    generatedAtPhase: s.generatedAtPhase,
    rulesetVersion: s.rulesetVersion,
    climateVersion: s.climateVersion,
    formulaVersion: s.formulaVersion,
    rngVersion: s.rngVersion,
  };
  return createEnvelope("strategic-weather-state", weatherPolicyId, surface).bodyHash;
}

export function withStrategicWeatherStateHash(
  s: Omit<StrategicWeatherState, "stateHash">,
): StrategicWeatherState {
  const full = s as StrategicWeatherState;
  assertFixedPointStrategicWeather(full);
  return { ...full, stateHash: computeStrategicWeatherStateHash(full) };
}
