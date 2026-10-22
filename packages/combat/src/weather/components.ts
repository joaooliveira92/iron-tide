import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  PRECIPITATION_TYPES,
  type PrecipitationType,
  TIME_OF_DAY_STATES,
  type TimeOfDayState,
  weatherComponentsPolicyId,
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
  SOLAR_BEARING_MIN_DEG,
  SOLAR_BEARING_MAX_DEG,
  SOLAR_ELEVATION_MIN_DEG,
  SOLAR_ELEVATION_MAX_DEG,
  GLARE_INTENSITY_MIN_BP,
  GLARE_INTENSITY_MAX_BP,
} from "./constants.js";
import { INVALID_TACTICAL_WEATHER_STATE, WEATHER_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export type LocalSmokeFieldId = string;

export interface BattleWeatherComponents {
  battleId: string;
  seaState: number;
  windDirectionDeg: number;
  windSpeedUmPerSec: number;
  precipitationType: PrecipitationType;
  precipitationIntensityBp: number;
  fogMistDensityBp: number;
  cloudCoverBp: number;
  timeOfDay: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
  glareIntensityBp: number;
  baseVisibilityUm: number;
  localSmokeFields: readonly LocalSmokeFieldId[];
  rulesetVersion: string;
  formulaVersion: string;
  stateHash: string;
}

function typeError(
  c: BattleWeatherComponents,
  field: string,
  value: unknown,
  reason: string,
): never {
  throw new BluewaveError(INVALID_TACTICAL_WEATHER_STATE, {
    code: INVALID_TACTICAL_WEATHER_STATE,
    field,
    reason,
    value,
  });
}

function invariantError(
  c: BattleWeatherComponents,
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
  c: BattleWeatherComponents,
  field: string,
  value: unknown,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    typeError(c, field, value, `${field} must be a non-empty string`);
  }
}

function requireInteger(
  c: BattleWeatherComponents,
  field: string,
  value: unknown,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    typeError(c, field, value, `${field} must be an integer`);
  }
  if (value < min || value > max) {
    invariantError(c, field, value, `${field} must be within [${min}, ${max}]`);
  }
}

function requireNonNegativeInteger(
  c: BattleWeatherComponents,
  field: string,
  value: unknown,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    typeError(c, field, value, `${field} must be an integer`);
  }
  if (value < 0) {
    invariantError(c, field, value, `${field} must be non-negative`);
  }
}

export function assertFixedPointTacticalWeather(c: BattleWeatherComponents): void {
  requireString(c, "battleId", c.battleId);

  requireInteger(c, "seaState", c.seaState, SEA_STATE_MIN, SEA_STATE_MAX);
  requireInteger(
    c,
    "windDirectionDeg",
    c.windDirectionDeg,
    WIND_DIRECTION_MIN_DEG,
    WIND_DIRECTION_MAX_DEG,
  );
  requireNonNegativeInteger(c, "windSpeedUmPerSec", c.windSpeedUmPerSec);

  if (!(PRECIPITATION_TYPES as readonly string[]).includes(c.precipitationType)) {
    invariantError(
      c,
      "precipitationType",
      c.precipitationType,
      "must be a canonical precipitation type",
    );
  }
  requireInteger(
    c,
    "precipitationIntensityBp",
    c.precipitationIntensityBp,
    PRECIPITATION_INTENSITY_MIN_BP,
    PRECIPITATION_INTENSITY_MAX_BP,
  );
  requireInteger(
    c,
    "fogMistDensityBp",
    c.fogMistDensityBp,
    FOG_MIST_DENSITY_MIN_BP,
    FOG_MIST_DENSITY_MAX_BP,
  );
  requireInteger(c, "cloudCoverBp", c.cloudCoverBp, CLOUD_COVER_MIN_BP, CLOUD_COVER_MAX_BP);

  if (!(TIME_OF_DAY_STATES as readonly string[]).includes(c.timeOfDay)) {
    invariantError(c, "timeOfDay", c.timeOfDay, "must be a canonical time-of-day state");
  }
  requireInteger(
    c,
    "solarBearingDeg",
    c.solarBearingDeg,
    SOLAR_BEARING_MIN_DEG,
    SOLAR_BEARING_MAX_DEG,
  );
  requireInteger(
    c,
    "solarElevationDeg",
    c.solarElevationDeg,
    SOLAR_ELEVATION_MIN_DEG,
    SOLAR_ELEVATION_MAX_DEG,
  );
  requireInteger(
    c,
    "glareIntensityBp",
    c.glareIntensityBp,
    GLARE_INTENSITY_MIN_BP,
    GLARE_INTENSITY_MAX_BP,
  );

  requireNonNegativeInteger(c, "baseVisibilityUm", c.baseVisibilityUm);

  if (
    !Array.isArray(c.localSmokeFields) ||
    !c.localSmokeFields.every((f) => typeof f === "string")
  ) {
    typeError(
      c,
      "localSmokeFields",
      c.localSmokeFields,
      "localSmokeFields must be an array of string ids",
    );
  }

  requireString(c, "rulesetVersion", c.rulesetVersion);
  requireString(c, "formulaVersion", c.formulaVersion);
}

export function computeTacticalWeatherComponentsHash(c: BattleWeatherComponents): string {
  const surface = {
    battleId: c.battleId,
    seaState: c.seaState,
    windDirectionDeg: c.windDirectionDeg,
    windSpeedUmPerSec: c.windSpeedUmPerSec,
    precipitationType: c.precipitationType,
    precipitationIntensityBp: c.precipitationIntensityBp,
    fogMistDensityBp: c.fogMistDensityBp,
    cloudCoverBp: c.cloudCoverBp,
    timeOfDay: c.timeOfDay,
    solarBearingDeg: c.solarBearingDeg,
    solarElevationDeg: c.solarElevationDeg,
    glareIntensityBp: c.glareIntensityBp,
    baseVisibilityUm: c.baseVisibilityUm,
    localSmokeFields: c.localSmokeFields,
    rulesetVersion: c.rulesetVersion,
    formulaVersion: c.formulaVersion,
  };
  return createEnvelope("tactical-weather-components", weatherComponentsPolicyId, surface).bodyHash;
}

export function withTacticalWeatherComponentsHash(
  c: Omit<BattleWeatherComponents, "stateHash">,
): BattleWeatherComponents {
  const full = c as BattleWeatherComponents;
  assertFixedPointTacticalWeather(full);
  return { ...full, stateHash: computeTacticalWeatherComponentsHash(full) };
}
