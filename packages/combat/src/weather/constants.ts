// Versioned authoritative weather base constants (DESIGN-42 §§1–6, §24–30 subset)
// shipped as a `weather_v1` policy + `SHIPPED_WEATHER_CONTRACT` +
// `validateWeatherContract`, mirroring packages/combat/src/gunnery/constants.ts.
// Fail-closed on mismatch. Grounded in docs/rules/weather-visibility-and-smoke.md
// and recorded in ADR-0022 (B-5 scope / integration boundary).
import { BluewaveError } from "@bluewave/contracts";
import { WEATHER_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const weatherPolicyId = "weather_v1" as const;

// fixed-point scale shared by every basis-point quantity in this subsystem.
// Named WEATHER_ prefix to avoid collision with gunnery/contact/other module
// exports in the combat barrel index.
export const WEATHER_BASIS_POINTS_PER_UNIT = 10_000 as const;

// ruleset + formula + climate + rng versions pinned by the weather_v1 contract.
export const WEATHER_RULESET_VERSION = "weather_ruleset_v1" as const;
export const WEATHER_FORMULA_VERSION = "weather_formula_v1" as const;
export const WEATHER_CLIMATE_VERSION = "weather_climate_v1" as const;
export const WEATHER_RNG_VERSION = "weather_rng_v1" as const;

// The monthly strategic generation phase (AC-2 / ADR-0022). Canonical phase id
// in the strategic phase registry; produced states carry it in generatedAtPhase.
export const WEATHER_GENERATION_PHASE = "weather_generation" as const;

// Phase identifiers for tactical-simulation RNG-decision ledger records
// (ADR-0022 §10; M6): battle-weather initialization local-variation draws and
// 30-minute tactical progression draws. These are canonical decision-phase ids
// (not registered strategic phases and not reason codes); the strategic registry
// phase remains `weather_generation`.
export const WEATHER_BATTLE_INITIALIZATION_PHASE = "battle_weather_initialization" as const;
export const WEATHER_TACTICAL_PROGRESSION_PHASE = "battle_weather_progression" as const;

// DESIGN-42 §1/§3 canonical integer bounds. Sea state is 0..9; every basis-point
// quantity (precipitation intensity, fog/mist density, cloud cover) is 0..10_000;
// wind direction is canonical angular units (integer degrees) 0..359; wind speed
// and visibility distance are integer micrometres (DESIGN-07 canonical units).
export const SEA_STATE_MIN = 0 as const;
export const SEA_STATE_MAX = 9 as const;
export const WIND_DIRECTION_MIN_DEG = 0 as const;
export const WIND_DIRECTION_MAX_DEG = 359 as const;
export const PRECIPITATION_INTENSITY_MIN_BP = 0 as const;
export const PRECIPITATION_INTENSITY_MAX_BP = 10_000 as const;
export const FOG_MIST_DENSITY_MIN_BP = 0 as const;
export const FOG_MIST_DENSITY_MAX_BP = 10_000 as const;
export const CLOUD_COVER_MIN_BP = 0 as const;
export const CLOUD_COVER_MAX_BP = 10_000 as const;

// Canonical precipitation types (DESIGN-42 §3/§26). Closed union; type is
// independent of intensity (intensity is the 0..10_000 basis-point quantity).
export const PRECIPITATION_TYPES = ["NONE", "RAIN", "SNOW"] as const;
export type PrecipitationType = (typeof PRECIPITATION_TYPES)[number];

// DESIGN-42 §27: the five canonical time-of-day states. Closed union; every
// state supplies explicit optical visibility, identification, gunnery,
// air-operation, and illumination policies (INC-4 nightTwilight module).
export const TIME_OF_DAY_STATES = [
  "DAY",
  "TWILIGHT_DAY",
  "TWILIGHT_NIGHT",
  "NIGHT",
  "DAWN_DUSK_TRANSITION",
] as const;
export type TimeOfDayState = (typeof TIME_OF_DAY_STATES)[number];

// DESIGN-42 §3 solar geometry + glare component bounds (canonical angular units).
export const SOLAR_BEARING_MIN_DEG = 0 as const;
export const SOLAR_BEARING_MAX_DEG = 359 as const;
export const SOLAR_ELEVATION_MIN_DEG = -90 as const;
export const SOLAR_ELEVATION_MAX_DEG = 90 as const;
export const GLARE_INTENSITY_MIN_BP = 0 as const;
export const GLARE_INTENSITY_MAX_BP = 10_000 as const;

// DESIGN-42 §2 local-variation policy (INC-2): battle weather MAY differ from
// the committed strategic source only through a versioned keyed decision under
// an explicit authored policy. Two shipped policies:
//   - none  (weather_local_variation_none_v1): components copy the strategic
//     state exactly; no random draw is consumed.
//   - light (weather_local_variation_light_v1): intensity/density/cloud-cover
//     components draw a bounded jitter (± the *_JITTER_BP constants) from the
//     battle-seed-keyed stream `battle/weather/<battleId>/local_variation`.
// Sea state, wind, precipitation type, and base visibility are never jittered
// at initialization: the committed strategic state is authoritative for them
// until tactical progression (INC-3) advances them.
export const LOCAL_VARIATION_POLICY_NONE = "weather_local_variation_none_v1" as const;
export const LOCAL_VARIATION_POLICY_LIGHT = "weather_local_variation_light_v1" as const;
export const LOCAL_VARIATION_POLICIES = [
  LOCAL_VARIATION_POLICY_NONE,
  LOCAL_VARIATION_POLICY_LIGHT,
] as const;
export type LocalVariationPolicy = (typeof LOCAL_VARIATION_POLICIES)[number];

// Shipped light-variation jitter bounds (basis points, drawn from the keyed
// battle stream and clamped to the component's canonical bounds).
export const LOCAL_VARIATION_PRECIPITATION_INTENSITY_JITTER_BP = 500 as const;
export const LOCAL_VARIATION_FOG_MIST_DENSITY_JITTER_BP = 500 as const;
export const LOCAL_VARIATION_CLOUD_COVER_JITTER_BP = 500 as const;

// INC-4: Environment effect constants (weather_environment_v1 policy).
// DESIGN-42 §24–27 glare, fog, precipitation, and night/twilight multipliers
// in basis points. Every value is a shipped versioned constant.

// §24 Glare angular separation bands (bp multipliers by angular separation of
// observer-to-target bearing from solar bearing).
export const GLARE_ANGLE_BAND_10_DEG = 10 as const;
export const GLARE_ANGLE_BAND_20_DEG = 20 as const;
export const GLARE_ANGLE_BAND_30_DEG = 30 as const;
export const GLARE_MULTIPLIER_BELOW_10_DEG_BP = 5_000 as const;
export const GLARE_MULTIPLIER_10_TO_20_DEG_BP = 7_500 as const;
export const GLARE_MULTIPLIER_20_TO_30_DEG_BP = 9_000 as const;
export const GLARE_MULTIPLIER_GE_30_DEG_BP = 10_000 as const;
export const GLARE_CLOUD_DISABLE_THRESHOLD_BP = 7_500 as const;
export const GLARE_NEUTRAL_MULTIPLIER_BP = 10_000 as const;

// §25 Fog visibility multiplier bands by density (bp).
// Density 0..999 → 10_000; 1_000..2_499 → 8_500; 2_500..4_999 → 6_000;
// 5_000..7_499 → 3_500; 7_500..10_000 → 1_500.
export const FOG_VIS_BAND_LIGHT_MIN_BP = 1_000 as const;
export const FOG_VIS_BAND_LIGHT_MAX_BP = 2_499 as const;
export const FOG_VIS_BAND_MODERATE_MIN_BP = 2_500 as const;
export const FOG_VIS_BAND_MODERATE_MAX_BP = 4_999 as const;
export const FOG_VIS_BAND_HEAVY_MIN_BP = 5_000 as const;
export const FOG_VIS_BAND_HEAVY_MAX_BP = 7_499 as const;
export const FOG_VIS_BAND_EXTREME_MIN_BP = 7_500 as const;
export const FOG_VIS_BAND_EXTREME_MAX_BP = 10_000 as const;
export const FOG_VIS_BAND_LIGHT_BP = 8_500 as const;
export const FOG_VIS_BAND_MODERATE_BP = 6_000 as const;
export const FOG_VIS_BAND_HEAVY_BP = 3_500 as const;
export const FOG_VIS_BAND_EXTREME_BP = 1_500 as const;
export const FOG_VIS_BAND_NONE_BP = 10_000 as const;

// §26 Precipitation visibility multiplier bands by intensity level.
// Intensity-bp thresholds (exclusive upper): none=0, light=2_500, moderate=5_000,
// heavy=7_500, extreme=10_000. When type is NONE the multiplier is always 10_000
// regardless of the intensity-bp value.
export const PRECIP_INTENSITY_LIGHT_MAX_BP = 2_499 as const;
export const PRECIP_INTENSITY_MODERATE_MAX_BP = 4_999 as const;
export const PRECIP_INTENSITY_HEAVY_MAX_BP = 7_499 as const;
export const PRECIP_VIS_LIGHT_BP = 9_000 as const;
export const PRECIP_VIS_MODERATE_BP = 7_500 as const;
export const PRECIP_VIS_HEAVY_BP = 5_000 as const;
export const PRECIP_VIS_EXTREME_BP = 2_500 as const;
export const PRECIP_VIS_NONE_BP = 10_000 as const;

// §27 Night/twilight per-state optical visibility multipliers (basis points).
// Each state also carries explicit identification, gunnery, air-operation, and
// illumination policies (recorded here as versioned constants; consumed by their
// owning subsystems).
export const DAYLIGHT_VIS_DAY_BP = 10_000 as const;
export const DAYLIGHT_VIS_TWILIGHT_DAY_BP = 9_000 as const;
export const DAYLIGHT_VIS_TWILIGHT_NIGHT_BP = 7_500 as const;
export const DAYLIGHT_VIS_NIGHT_BP = 3_500 as const;
export const DAYLIGHT_VIS_DUSK_DAWN_BP = 7_500 as const;
// Identification-range multipliers (bp of neutral identification distance).
export const DAYLIGHT_IDENTIFICATION_DAY_BP = 10_000 as const;
export const DAYLIGHT_IDENTIFICATION_TWILIGHT_DAY_BP = 8_000 as const;
export const DAYLIGHT_IDENTIFICATION_TWILIGHT_NIGHT_BP = 5_000 as const;
export const DAYLIGHT_IDENTIFICATION_NIGHT_BP = 2_000 as const;
export const DAYLIGHT_IDENTIFICATION_DUSK_DAWN_BP = 5_000 as const;
// Gunnery accuracy multipliers (bp of base accuracy; applied by B-3).
export const DAYLIGHT_GUNNERY_DAY_BP = 10_000 as const;
export const DAYLIGHT_GUNNERY_TWILIGHT_DAY_BP = 9_000 as const;
export const DAYLIGHT_GUNNERY_TWILIGHT_NIGHT_BP = 7_000 as const;
export const DAYLIGHT_GUNNERY_NIGHT_BP = 4_000 as const;
export const DAYLIGHT_GUNNERY_DUSK_DAWN_BP = 7_000 as const;
// Air-operation policy multipliers (consumed by air subsystem).
export const DAYLIGHT_AIR_OPS_DAY_BP = 10_000 as const;
export const DAYLIGHT_AIR_OPS_TWILIGHT_DAY_BP = 9_000 as const;
export const DAYLIGHT_AIR_OPS_TWILIGHT_NIGHT_BP = 8_000 as const;
export const DAYLIGHT_AIR_OPS_NIGHT_BP = 5_000 as const;
export const DAYLIGHT_AIR_OPS_DUSK_DAWN_BP = 8_000 as const;
// Illumination policy multipliers (effect of artificial illumination on spotting).
export const DAYLIGHT_ILLUMINATION_DAY_BP = 10_000 as const;
export const DAYLIGHT_ILLUMINATION_TWILIGHT_DAY_BP = 8_000 as const;
export const DAYLIGHT_ILLUMINATION_TWILIGHT_NIGHT_BP = 5_000 as const;
export const DAYLIGHT_ILLUMINATION_NIGHT_BP = 2_000 as const;
export const DAYLIGHT_ILLUMINATION_DUSK_DAWN_BP = 5_000 as const;

// DESIGN-42 §4: the shipped tactical-weather reevaluation interval is exactly 30
// tactical minutes (tactical_weather_progression_v1 policy, INC-3).
export const TACTICAL_WEATHER_PROGRESSION_INTERVAL_MINUTES = 30 as const;

// DESIGN-42 §5: the visibility-distance product divides once by 10_000^5 (five
// explicit basis-point multipliers) and rounds exactly once with FLOOR (INC-3).
export const VISIBILITY_SCALE_EXPONENT = 5 as const;
export const VISIBILITY_ROUNDING = "floor" as const;

export interface WeatherContract {
  policyId: string;
  basisPointsPerUnit: number;
  seaStateMin: number;
  seaStateMax: number;
  windDirectionMinDeg: number;
  windDirectionMaxDeg: number;
  precipitationIntensityMinBp: number;
  precipitationIntensityMaxBp: number;
  fogMistDensityMinBp: number;
  fogMistDensityMaxBp: number;
  cloudCoverMinBp: number;
  cloudCoverMaxBp: number;
  rulesetVersion: string;
  formulaVersion: string;
  climateVersion: string;
  rngVersion: string;
}

export const SHIPPED_WEATHER_CONTRACT: WeatherContract = {
  policyId: weatherPolicyId,
  basisPointsPerUnit: WEATHER_BASIS_POINTS_PER_UNIT,
  seaStateMin: SEA_STATE_MIN,
  seaStateMax: SEA_STATE_MAX,
  windDirectionMinDeg: WIND_DIRECTION_MIN_DEG,
  windDirectionMaxDeg: WIND_DIRECTION_MAX_DEG,
  precipitationIntensityMinBp: PRECIPITATION_INTENSITY_MIN_BP,
  precipitationIntensityMaxBp: PRECIPITATION_INTENSITY_MAX_BP,
  fogMistDensityMinBp: FOG_MIST_DENSITY_MIN_BP,
  fogMistDensityMaxBp: FOG_MIST_DENSITY_MAX_BP,
  cloudCoverMinBp: CLOUD_COVER_MIN_BP,
  cloudCoverMaxBp: CLOUD_COVER_MAX_BP,
  rulesetVersion: WEATHER_RULESET_VERSION,
  formulaVersion: WEATHER_FORMULA_VERSION,
  climateVersion: WEATHER_CLIMATE_VERSION,
  rngVersion: WEATHER_RNG_VERSION,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(WEATHER_STATE_INVARIANT_FAILED, {
    code: WEATHER_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

export function validateWeatherContract(
  c: Partial<WeatherContract> | null | undefined,
): asserts c is WeatherContract {
  if (!c) throwMismatch(c, "weather_v1 missing contract");
  if (c.policyId !== weatherPolicyId) throwMismatch(c, "weather_v1 expected policy id");
  if (c.basisPointsPerUnit !== WEATHER_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "weather_v1 basis-point scale");
  if (c.seaStateMin !== SEA_STATE_MIN || c.seaStateMax !== SEA_STATE_MAX)
    throwMismatch(c, "weather_v1 sea-state bounds (0..9)");
  if (
    c.windDirectionMinDeg !== WIND_DIRECTION_MIN_DEG ||
    c.windDirectionMaxDeg !== WIND_DIRECTION_MAX_DEG
  )
    throwMismatch(c, "weather_v1 wind-direction bounds (0..359)");
  if (
    c.precipitationIntensityMinBp !== PRECIPITATION_INTENSITY_MIN_BP ||
    c.precipitationIntensityMaxBp !== PRECIPITATION_INTENSITY_MAX_BP
  )
    throwMismatch(c, "weather_v1 precipitation-intensity bounds");
  if (
    c.fogMistDensityMinBp !== FOG_MIST_DENSITY_MIN_BP ||
    c.fogMistDensityMaxBp !== FOG_MIST_DENSITY_MAX_BP
  )
    throwMismatch(c, "weather_v1 fog/mist-density bounds");
  if (c.cloudCoverMinBp !== CLOUD_COVER_MIN_BP || c.cloudCoverMaxBp !== CLOUD_COVER_MAX_BP)
    throwMismatch(c, "weather_v1 cloud-cover bounds");
  if (
    c.rulesetVersion !== WEATHER_RULESET_VERSION ||
    c.formulaVersion !== WEATHER_FORMULA_VERSION ||
    c.climateVersion !== WEATHER_CLIMATE_VERSION ||
    c.rngVersion !== WEATHER_RNG_VERSION
  )
    throwMismatch(c, "weather_v1 ruleset/formula/climate/rng versions");
}

// DESIGN-42 §3 tactical weather component contract (INC-2). The twelve canonical
// components all use integer canonical units under the bounds declared here;
// shipped as `weather_components_v1` + SHIPPED_WEATHER_COMPONENTS_CONTRACT +
// validateWeatherComponentsContract. Fail-closed on mismatch.
export const weatherComponentsPolicyId = "weather_components_v1" as const;

export interface WeatherComponentsContract {
  policyId: string;
  basisPointsPerUnit: number;
  seaStateMin: number;
  seaStateMax: number;
  windDirectionMinDeg: number;
  windDirectionMaxDeg: number;
  precipitationIntensityMinBp: number;
  precipitationIntensityMaxBp: number;
  fogMistDensityMinBp: number;
  fogMistDensityMaxBp: number;
  cloudCoverMinBp: number;
  cloudCoverMaxBp: number;
  solarBearingMinDeg: number;
  solarBearingMaxDeg: number;
  solarElevationMinDeg: number;
  solarElevationMaxDeg: number;
  glareIntensityMinBp: number;
  glareIntensityMaxBp: number;
  timeOfDayStates: readonly TimeOfDayState[];
  localVariationPolicies: readonly string[];
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_WEATHER_COMPONENTS_CONTRACT: WeatherComponentsContract = {
  policyId: weatherComponentsPolicyId,
  basisPointsPerUnit: WEATHER_BASIS_POINTS_PER_UNIT,
  seaStateMin: SEA_STATE_MIN,
  seaStateMax: SEA_STATE_MAX,
  windDirectionMinDeg: WIND_DIRECTION_MIN_DEG,
  windDirectionMaxDeg: WIND_DIRECTION_MAX_DEG,
  precipitationIntensityMinBp: PRECIPITATION_INTENSITY_MIN_BP,
  precipitationIntensityMaxBp: PRECIPITATION_INTENSITY_MAX_BP,
  fogMistDensityMinBp: FOG_MIST_DENSITY_MIN_BP,
  fogMistDensityMaxBp: FOG_MIST_DENSITY_MAX_BP,
  cloudCoverMinBp: CLOUD_COVER_MIN_BP,
  cloudCoverMaxBp: CLOUD_COVER_MAX_BP,
  solarBearingMinDeg: SOLAR_BEARING_MIN_DEG,
  solarBearingMaxDeg: SOLAR_BEARING_MAX_DEG,
  solarElevationMinDeg: SOLAR_ELEVATION_MIN_DEG,
  solarElevationMaxDeg: SOLAR_ELEVATION_MAX_DEG,
  glareIntensityMinBp: GLARE_INTENSITY_MIN_BP,
  glareIntensityMaxBp: GLARE_INTENSITY_MAX_BP,
  timeOfDayStates: TIME_OF_DAY_STATES,
  localVariationPolicies: LOCAL_VARIATION_POLICIES,
  rulesetVersion: WEATHER_RULESET_VERSION,
  formulaVersion: WEATHER_FORMULA_VERSION,
};

function throwComponentsMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(WEATHER_STATE_INVARIANT_FAILED, {
    code: WEATHER_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateWeatherComponentsContract(
  c: Partial<WeatherComponentsContract> | null | undefined,
): asserts c is WeatherComponentsContract {
  if (!c) throwComponentsMismatch(c, "weather_components_v1 missing contract");
  if (c.policyId !== weatherComponentsPolicyId)
    throwComponentsMismatch(c, "weather_components_v1 expected policy id");
  if (c.basisPointsPerUnit !== WEATHER_BASIS_POINTS_PER_UNIT)
    throwComponentsMismatch(c, "weather_components_v1 basis-point scale");
  if (c.seaStateMin !== SEA_STATE_MIN || c.seaStateMax !== SEA_STATE_MAX)
    throwComponentsMismatch(c, "weather_components_v1 sea-state bounds");
  if (
    c.windDirectionMinDeg !== WIND_DIRECTION_MIN_DEG ||
    c.windDirectionMaxDeg !== WIND_DIRECTION_MAX_DEG
  )
    throwComponentsMismatch(c, "weather_components_v1 wind-direction bounds");
  if (
    c.precipitationIntensityMinBp !== PRECIPITATION_INTENSITY_MIN_BP ||
    c.precipitationIntensityMaxBp !== PRECIPITATION_INTENSITY_MAX_BP
  )
    throwComponentsMismatch(c, "weather_components_v1 precipitation-intensity bounds");
  if (
    c.fogMistDensityMinBp !== FOG_MIST_DENSITY_MIN_BP ||
    c.fogMistDensityMaxBp !== FOG_MIST_DENSITY_MAX_BP
  )
    throwComponentsMismatch(c, "weather_components_v1 fog/mist-density bounds");
  if (c.cloudCoverMinBp !== CLOUD_COVER_MIN_BP || c.cloudCoverMaxBp !== CLOUD_COVER_MAX_BP)
    throwComponentsMismatch(c, "weather_components_v1 cloud-cover bounds");
  if (
    c.solarBearingMinDeg !== SOLAR_BEARING_MIN_DEG ||
    c.solarBearingMaxDeg !== SOLAR_BEARING_MAX_DEG
  )
    throwComponentsMismatch(c, "weather_components_v1 solar-bearing bounds");
  if (
    c.solarElevationMinDeg !== SOLAR_ELEVATION_MIN_DEG ||
    c.solarElevationMaxDeg !== SOLAR_ELEVATION_MAX_DEG
  )
    throwComponentsMismatch(c, "weather_components_v1 solar-elevation bounds (-90..90)");
  if (
    c.glareIntensityMinBp !== GLARE_INTENSITY_MIN_BP ||
    c.glareIntensityMaxBp !== GLARE_INTENSITY_MAX_BP
  )
    throwComponentsMismatch(c, "weather_components_v1 glare-intensity bounds");
  if (!c.timeOfDayStates || !arrayEquals(c.timeOfDayStates, TIME_OF_DAY_STATES))
    throwComponentsMismatch(c, "weather_components_v1 time-of-day states");
  if (!c.localVariationPolicies || !arrayEquals(c.localVariationPolicies, LOCAL_VARIATION_POLICIES))
    throwComponentsMismatch(c, "weather_components_v1 local-variation policies");
  if (c.rulesetVersion !== WEATHER_RULESET_VERSION || c.formulaVersion !== WEATHER_FORMULA_VERSION)
    throwComponentsMismatch(c, "weather_components_v1 ruleset/formula versions");
}

// DESIGN-42 §5 visibility contract (INC-3). The shipped exponent is 5 (five 10_000
// basis-point multipliers) with FLOOR rounding.
export const weatherVisibilityPolicyId = "weather_visibility_v1" as const;

export interface WeatherVisibilityContract {
  policyId: string;
  basisPointsPerUnit: number;
  scaleExponent: number;
  rounding: string;
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_WEATHER_VISIBILITY_CONTRACT: WeatherVisibilityContract = {
  policyId: weatherVisibilityPolicyId,
  basisPointsPerUnit: WEATHER_BASIS_POINTS_PER_UNIT,
  scaleExponent: VISIBILITY_SCALE_EXPONENT,
  rounding: VISIBILITY_ROUNDING,
  rulesetVersion: WEATHER_RULESET_VERSION,
  formulaVersion: WEATHER_FORMULA_VERSION,
};

function throwVisibilityMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(WEATHER_STATE_INVARIANT_FAILED, {
    code: WEATHER_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

export function validateWeatherVisibilityContract(
  c: Partial<WeatherVisibilityContract> | null | undefined,
): asserts c is WeatherVisibilityContract {
  if (!c) throwVisibilityMismatch(c, "weather_visibility_v1 missing contract");
  if (c.policyId !== weatherVisibilityPolicyId)
    throwVisibilityMismatch(c, "weather_visibility_v1 expected policy id");
  if (c.basisPointsPerUnit !== WEATHER_BASIS_POINTS_PER_UNIT)
    throwVisibilityMismatch(c, "weather_visibility_v1 basis-point scale");
  if (c.scaleExponent !== VISIBILITY_SCALE_EXPONENT)
    throwVisibilityMismatch(c, "weather_visibility_v1 scale exponent");
  if (c.rounding !== VISIBILITY_ROUNDING)
    throwVisibilityMismatch(c, "weather_visibility_v1 rounding mode");
  if (c.rulesetVersion !== WEATHER_RULESET_VERSION || c.formulaVersion !== WEATHER_FORMULA_VERSION)
    throwVisibilityMismatch(c, "weather_visibility_v1 ruleset/formula versions");
}

// DESIGN-42 §24–27 environment effect contract (INC-4). Carries the shipped
// glare, fog, precipitation, and night/twilight multiplier tables.
export const weatherEnvironmentPolicyId = "weather_environment_v1" as const;

export interface WeatherEnvironmentContract {
  policyId: string;
  basisPointsPerUnit: number;
  // Glare
  glareAngleBandBelow10Deg: number;
  glareMultiplierBelow10DegBp: number;
  glareMultiplier10to20DegBp: number;
  glareMultiplier20to30DegBp: number;
  glareMultiplierGe30DegBp: number;
  glareCloudDisableThresholdBp: number;
  // Fog
  fogVisBandNoneBp: number;
  fogVisBandLightBp: number;
  fogVisBandModerateBp: number;
  fogVisBandHeavyBp: number;
  fogVisBandExtremeBp: number;
  // Precipitation
  precipVisNoneBp: number;
  precipVisLightBp: number;
  precipVisModerateBp: number;
  precipVisHeavyBp: number;
  precipVisExtremeBp: number;
  // Night/twilight visibility
  daylightVisDayBp: number;
  daylightVisTwilightDayBp: number;
  daylightVisTwilightNightBp: number;
  daylightVisNightBp: number;
  daylightVisDuskDawnBp: number;
  // Other per-state policies
  daylightIdentificationDayBp: number;
  daylightIdentificationTwilightDayBp: number;
  daylightIdentificationTwilightNightBp: number;
  daylightIdentificationNightBp: number;
  daylightIdentificationDuskDawnBp: number;
  daylightGunneryDayBp: number;
  daylightGunneryTwilightDayBp: number;
  daylightGunneryTwilightNightBp: number;
  daylightGunneryNightBp: number;
  daylightGunneryDuskDawnBp: number;
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_WEATHER_ENVIRONMENT_CONTRACT: WeatherEnvironmentContract = {
  policyId: weatherEnvironmentPolicyId,
  basisPointsPerUnit: WEATHER_BASIS_POINTS_PER_UNIT,
  glareAngleBandBelow10Deg: GLARE_ANGLE_BAND_10_DEG,
  glareMultiplierBelow10DegBp: GLARE_MULTIPLIER_BELOW_10_DEG_BP,
  glareMultiplier10to20DegBp: GLARE_MULTIPLIER_10_TO_20_DEG_BP,
  glareMultiplier20to30DegBp: GLARE_MULTIPLIER_20_TO_30_DEG_BP,
  glareMultiplierGe30DegBp: GLARE_MULTIPLIER_GE_30_DEG_BP,
  glareCloudDisableThresholdBp: GLARE_CLOUD_DISABLE_THRESHOLD_BP,
  fogVisBandNoneBp: FOG_VIS_BAND_NONE_BP,
  fogVisBandLightBp: FOG_VIS_BAND_LIGHT_BP,
  fogVisBandModerateBp: FOG_VIS_BAND_MODERATE_BP,
  fogVisBandHeavyBp: FOG_VIS_BAND_HEAVY_BP,
  fogVisBandExtremeBp: FOG_VIS_BAND_EXTREME_BP,
  precipVisNoneBp: PRECIP_VIS_NONE_BP,
  precipVisLightBp: PRECIP_VIS_LIGHT_BP,
  precipVisModerateBp: PRECIP_VIS_MODERATE_BP,
  precipVisHeavyBp: PRECIP_VIS_HEAVY_BP,
  precipVisExtremeBp: PRECIP_VIS_EXTREME_BP,
  daylightVisDayBp: DAYLIGHT_VIS_DAY_BP,
  daylightVisTwilightDayBp: DAYLIGHT_VIS_TWILIGHT_DAY_BP,
  daylightVisTwilightNightBp: DAYLIGHT_VIS_TWILIGHT_NIGHT_BP,
  daylightVisNightBp: DAYLIGHT_VIS_NIGHT_BP,
  daylightVisDuskDawnBp: DAYLIGHT_VIS_DUSK_DAWN_BP,
  daylightIdentificationDayBp: DAYLIGHT_IDENTIFICATION_DAY_BP,
  daylightIdentificationTwilightDayBp: DAYLIGHT_IDENTIFICATION_TWILIGHT_DAY_BP,
  daylightIdentificationTwilightNightBp: DAYLIGHT_IDENTIFICATION_TWILIGHT_NIGHT_BP,
  daylightIdentificationNightBp: DAYLIGHT_IDENTIFICATION_NIGHT_BP,
  daylightIdentificationDuskDawnBp: DAYLIGHT_IDENTIFICATION_DUSK_DAWN_BP,
  daylightGunneryDayBp: DAYLIGHT_GUNNERY_DAY_BP,
  daylightGunneryTwilightDayBp: DAYLIGHT_GUNNERY_TWILIGHT_DAY_BP,
  daylightGunneryTwilightNightBp: DAYLIGHT_GUNNERY_TWILIGHT_NIGHT_BP,
  daylightGunneryNightBp: DAYLIGHT_GUNNERY_NIGHT_BP,
  daylightGunneryDuskDawnBp: DAYLIGHT_GUNNERY_DUSK_DAWN_BP,
  rulesetVersion: WEATHER_RULESET_VERSION,
  formulaVersion: WEATHER_FORMULA_VERSION,
};

function throwEnvironmentMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(WEATHER_STATE_INVARIANT_FAILED, {
    code: WEATHER_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

export function validateWeatherEnvironmentContract(
  c: Partial<WeatherEnvironmentContract> | null | undefined,
): asserts c is WeatherEnvironmentContract {
  if (!c) throwEnvironmentMismatch(c, "weather_environment_v1 missing contract");
  if (c.policyId !== weatherEnvironmentPolicyId)
    throwEnvironmentMismatch(c, "weather_environment_v1 expected policy id");
  if (c.basisPointsPerUnit !== WEATHER_BASIS_POINTS_PER_UNIT)
    throwEnvironmentMismatch(c, "weather_environment_v1 basis-point scale");
  if (c.glareAngleBandBelow10Deg !== GLARE_ANGLE_BAND_10_DEG)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare band angle");
  if (c.glareMultiplierBelow10DegBp !== GLARE_MULTIPLIER_BELOW_10_DEG_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare <10° multiplier");
  if (c.glareMultiplier10to20DegBp !== GLARE_MULTIPLIER_10_TO_20_DEG_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare 10-20° multiplier");
  if (c.glareMultiplier20to30DegBp !== GLARE_MULTIPLIER_20_TO_30_DEG_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare 20-30° multiplier");
  if (c.glareMultiplierGe30DegBp !== GLARE_MULTIPLIER_GE_30_DEG_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare ≥30° multiplier");
  if (c.glareCloudDisableThresholdBp !== GLARE_CLOUD_DISABLE_THRESHOLD_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 glare cloud disable threshold");
  // Fog multipliers
  if (c.fogVisBandNoneBp !== FOG_VIS_BAND_NONE_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 fog none band");
  if (c.fogVisBandLightBp !== FOG_VIS_BAND_LIGHT_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 fog light band");
  if (c.fogVisBandModerateBp !== FOG_VIS_BAND_MODERATE_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 fog moderate band");
  if (c.fogVisBandHeavyBp !== FOG_VIS_BAND_HEAVY_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 fog heavy band");
  if (c.fogVisBandExtremeBp !== FOG_VIS_BAND_EXTREME_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 fog extreme band");
  // Precip multipliers
  if (c.precipVisNoneBp !== PRECIP_VIS_NONE_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 precip none");
  if (c.precipVisLightBp !== PRECIP_VIS_LIGHT_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 precip light");
  if (c.precipVisModerateBp !== PRECIP_VIS_MODERATE_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 precip moderate");
  if (c.precipVisHeavyBp !== PRECIP_VIS_HEAVY_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 precip heavy");
  if (c.precipVisExtremeBp !== PRECIP_VIS_EXTREME_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 precip extreme");
  // Night/twilight visibility multipliers
  if (c.daylightVisDayBp !== DAYLIGHT_VIS_DAY_BP || c.daylightVisNightBp !== DAYLIGHT_VIS_NIGHT_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 daylight visibility day/night");
  if (c.daylightVisTwilightDayBp !== DAYLIGHT_VIS_TWILIGHT_DAY_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 daylight visibility twilight_day");
  if (c.daylightVisTwilightNightBp !== DAYLIGHT_VIS_TWILIGHT_NIGHT_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 daylight visibility twilight_night");
  if (c.daylightVisDuskDawnBp !== DAYLIGHT_VIS_DUSK_DAWN_BP)
    throwEnvironmentMismatch(c, "weather_environment_v1 daylight visibility dusk_dawn");
  if (c.rulesetVersion !== WEATHER_RULESET_VERSION || c.formulaVersion !== WEATHER_FORMULA_VERSION)
    throwEnvironmentMismatch(c, "weather_environment_v1 ruleset/formula versions");
}
