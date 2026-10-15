//packages/combat/src/weather/components.ts
// DESIGN-42 §3 canonical tactical weather components (INC-2/AC-4): the twelve
// component set every battle carries. Every numeric component uses canonical
// integer units (DESIGN-07); non-integers and malformed types are rejected with
// INVALID_TACTICAL_WEATHER_STATE at the construction boundary, out-of-range
// values with WEATHER_STATE_INVARIANT_FAILED. The state carries an authoritative
// state hash. Pure/deterministic: no ambient I/O/clock/random.
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

/** Stable identifier of a local smoke field. Smoke (§§7–23) is deferred to M3;
 *  the component slot exists per §3 and is an ordered empty list this slice. */
export type LocalSmokeFieldId = string;

export interface BattleWeatherComponents {
  /** Battle the components belong to (stable id, for record identity). */
  battleId: string;
  /** Sea state, integer 0..9. */
  seaState: number;
  /** Wind direction in canonical angular units (integer degrees 0..359). */
  windDirectionDeg: number;
  /** Wind speed in integer micrometres per second. */
  windSpeedUmPerSec: number;
  /** Precipitation type (NONE | RAIN | SNOW). */
  precipitationType: PrecipitationType;
  /** Precipitation intensity in basis points 0..10_000. */
  precipitationIntensityBp: number;
  /** Fog or mist density in basis points 0..10_000. */
  fogMistDensityBp: number;
  /** Cloud cover in basis points 0..10_000. */
  cloudCoverBp: number;
  /** Time of day (five canonical states, DESIGN-42 §27). */
  timeOfDay: TimeOfDayState;
  /** Solar bearing in canonical angular units (integer degrees 0..359). */
  solarBearingDeg: number;
  /** Solar elevation in integer degrees -90..90 (negative = below horizon). */
  solarElevationDeg: number;
  /** Glare intensity in basis points 0..10_000. */
  glareIntensityBp: number;
  /** Base visibility distance in integer micrometres. */
  baseVisibilityUm: number;
  /** Ordered local smoke-field identifiers (empty this slice; smoke deferred). */
  localSmokeFields: readonly LocalSmokeFieldId[];
  /** Ruleset version. */
  rulesetVersion: string;
  /** Formula version. */
  formulaVersion: string;
  /** Authoritative state hash (deterministic). */
  stateHash: string;
}

// ---- Guard helpers (mirror strategic-state.ts) ----

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

// AC-4: reject any non-integer / malformed field in the authoritative
// BattleWeatherComponents surface with INVALID_TACTICAL_WEATHER_STATE (type
// violations) or WEATHER_STATE_INVARIANT_FAILED (range violations). Reversible
// to invariant: a failure leaves the supplied components untouched.
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

// ---- State hash ----

// Authoritative deterministic component hash: canonicalSerialize + sha256 over
// the non-hash surface, domain-separated with the weather_components_v1
// compatibility version. Any provided stateHash is ignored.
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

// Build fully-invariant BattleWeatherComponents with its authoritative hash.
export function withTacticalWeatherComponentsHash(
  c: Omit<BattleWeatherComponents, "stateHash">,
): BattleWeatherComponents {
  const full = c as BattleWeatherComponents;
  assertFixedPointTacticalWeather(full);
  return { ...full, stateHash: computeTacticalWeatherComponentsHash(full) };
}
