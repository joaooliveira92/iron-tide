//packages/combat/src/weather/climate.ts
// DESIGN-42 §1/§4 strategic weather generation (AC-2): per-area monthly
// StrategicWeatherState generated from a canonical ClimateProfile, calendar
// month, prior persistent state, and the versioned keyed RNG stream
// `campaign/weather/<areaId>/<month>`. Pure/deterministic: no ambient I/O/clock/
// random; the only randomness enters through the explicit campaign seed via the
// keyed stream. A missing climate profile, missing month->season assignment, or
// an incomplete declared transition policy fails closed with
// WEATHER_PROFILE_INCOMPLETE (never a silent fallback).
//
// Production-pack climate-profile YAML is CONTENT-track (deferred); this module
// defines the pure TypeScript surface that tests (and later the campaign layer)
// author concrete profiles against.
import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, type RandomLedger } from "@bluewave/random";
import { drawUniform } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import {
  WEATHER_RULESET_VERSION,
  WEATHER_FORMULA_VERSION,
  WEATHER_RNG_VERSION,
  WEATHER_GENERATION_PHASE,
  type PrecipitationType,
} from "./constants.js";
import { WEATHER_PROFILE_INCOMPLETE } from "./reasonCodes.js";
import { type StrategicWeatherState, withStrategicWeatherStateHash } from "./strategic-state.js";

// ---- Authored climate surface ----

export interface IntegerRange {
  min: number;
  max: number;
}

// Canonical angular wind band (DERIVED §4 direction bands). Bands are authored
// with a relative weighted-draw weight; the nominal direction is the integer
// canonical angular unit (degrees 0..359) a draw of this band yields.
export interface WindBand {
  bandId: string;
  /** Canonical nominal direction in integer degrees 0..359. */
  directionDeg: number;
  /** Relative weighted-draw weight (integer >= 1). */
  weight: number;
}

export interface PrecipitationOption {
  type: PrecipitationType;
  /** Relative weighted-draw weight (integer >= 1). */
  weight: number;
  /** Intensity range in basis points 0..10_000 (per type). */
  intensityRangeBp: IntegerRange;
}

export interface SeasonClimateProfile {
  seasonId: string;
  /** Sea-state range, integer 0..9. */
  seaStateRange: IntegerRange;
  windBands: readonly WindBand[];
  /** Wind speed range in integer micrometres per second. */
  windSpeedRangeUmPerSec: IntegerRange;
  precipitationOptions: readonly PrecipitationOption[];
  /** Fog/mist density range in basis points 0..10_000. */
  fogMistDensityRangeBp: IntegerRange;
  /** Cloud-cover range in basis points 0..10_000. */
  cloudCoverRangeBp: IntegerRange;
  daylightProfileId: string;
  /** Whether the season profile declares the area glare-eligible. */
  glareEligible: boolean;
  /** Base visibility range in integer micrometres. */
  baseVisibilityRangeUm: IntegerRange;
  // ---- INC-3/§4: tactical-weather transition tables (optional — when absent,
  // the component stays unchanged in that interval, an explicit no-transition
  // policy per DESIGN-42 §4). ----
  /** Per-interval sea-state drift range in sea-state levels (±1 max per §4). */
  seaStateDriftRange?: IntegerRange;
  /** Per-interval wind-speed drift range in µm/s. */
  windSpeedDriftRangeUmPerSec?: IntegerRange;
  /** Per-band wind direction transitions: maps bandId → reachable bands + weights. */
  windTransitions?: Record<string, { reachableBandIds: string[]; weights: number[] }>;
  /** Precipitation transitions per type: maps PrecipitationType-string → reachable options. */
  precipitationTransitions?: Record<
    string,
    readonly {
      type: PrecipitationType;
      weight: number;
      intensityDriftRangeBp: IntegerRange;
    }[]
  >;
  /** Per-interval fog/mist density drift in basis points. */
  fogDriftRangeBp?: IntegerRange;
  /** Per-interval cloud-cover drift in basis points. */
  cloudDriftRangeBp?: IntegerRange;
  /** Per-interval base-visibility drift in micrometres. */
  visibilityDriftRangeUm?: IntegerRange;
}

export interface ClimateProfile {
  climateProfileId: string;
  climateVersion: string;
  /** Month id -> season id. A month missing here fails with WEATHER_PROFILE_INCOMPLETE. */
  seasonAssignment: Record<string, string>;
  seasons: readonly SeasonClimateProfile[];
}

export interface StrategicWeatherGenerationInput {
  areaId: string;
  /** Campaign month id (e.g. "1880-02"); the keyed stream domain includes it. */
  month: string;
  /** Canonical climate profile; missing -> WEATHER_PROFILE_INCOMPLETE. */
  climateProfile: ClimateProfile | null | undefined;
  /** Campaign seed; the keyed stream derives `campaign/weather/<areaId>/<month>` from it. */
  campaignSeed: string;
  /** Prior persistent state (recorded as persistentWeatherStateId; distributional
   *  persistence is not invented here — DESIGN-42 defines no monthly persistence
   *  formula, so the linkage is explicit and versioned, see ADR-0022). */
  priorState?: StrategicWeatherState;
  /** Optional ledger to record every keyed random decision (port pattern). */
  randomLedger?: RandomLedger;
}

// ---- Weighted-draw helper (deterministic; consumes exactly one stream draw) ----

function drawWeightedId(
  stream: { next(): number },
  options: readonly { weight: number }[],
): number {
  let total = 0;
  for (const o of options) total += o.weight;
  const scaled = stream.next() * total;
  let cumulative = 0;
  for (let i = 0; i < options.length; i++) {
    cumulative += options[i]!.weight;
    if (scaled <= cumulative) return i;
  }
  return options.length - 1;
}

function profileError(input: StrategicWeatherGenerationInput, reason: string): never {
  throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
    code: WEATHER_PROFILE_INCOMPLETE,
    areaId: input.areaId,
    month: input.month,
    reason,
  });
}

function transitionError(climateProfileId: string, seasonId: string, reason: string): never {
  throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
    code: WEATHER_PROFILE_INCOMPLETE,
    climateProfileId,
    seasonId,
    reason,
  });
}

// Validate the declared INC-3/§4 transition tables of one season so a malformed
// policy fails closed (DESIGN-42 §1: "A missing climate or transition policy
// MUST fail with WEATHER_PROFILE_INCOMPLETE") — never silently skipping a drawn
// field at first use. Covers:
//   - windTransitions keys/reachable bands referencing undeclared bands;
//   - reachableBandIds/weights length mismatch or non-positive weights;
//   - precipitation-transition option types outside the canonical types, or
//     invalid weight / drift-range surfaces.
// Shared by strategic generation (assertProfileComplete) and the tactical
// progression engine (progressBattleWeatherComponents).
export function validateSeasonTransitionTables(
  season: SeasonClimateProfile,
  climateProfileId: string,
  seasonId: string,
): void {
  const bandIds = new Set(season.windBands.map((b) => b.bandId));
  if (season.windTransitions) {
    for (const [fromBandId, entry] of Object.entries(season.windTransitions)) {
      if (!bandIds.has(fromBandId)) {
        transitionError(
          climateProfileId,
          seasonId,
          `wind transition table declares source band '${fromBandId}' which is not in windBands`,
        );
      }
      if (
        !Array.isArray(entry.reachableBandIds) ||
        !Array.isArray(entry.weights) ||
        entry.reachableBandIds.length === 0 ||
        entry.reachableBandIds.length !== entry.weights.length
      ) {
        transitionError(
          climateProfileId,
          seasonId,
          `wind transition table for band '${fromBandId}' has reachableBandIds/weights mismatch`,
        );
      }
      for (const w of entry.weights) {
        if (!Number.isInteger(w) || w < 1) {
          transitionError(
            climateProfileId,
            seasonId,
            `wind transition table for band '${fromBandId}' has non-positive weight`,
          );
        }
      }
      for (const toId of entry.reachableBandIds) {
        if (!bandIds.has(toId)) {
          transitionError(
            climateProfileId,
            seasonId,
            `wind transition table for band '${fromBandId}' references undeclared band '${toId}'`,
          );
        }
      }
    }
  }
  if (season.precipitationTransitions) {
    const canonical = new Set<string>(["NONE", "RAIN", "SNOW"]);
    for (const [type, options] of Object.entries(season.precipitationTransitions)) {
      if (!canonical.has(type)) {
        transitionError(
          climateProfileId,
          seasonId,
          `precipitation transition table key '${type}' is not a canonical precipitation type`,
        );
      }
      if (!Array.isArray(options) || options.length === 0) {
        transitionError(
          climateProfileId,
          seasonId,
          `precipitation transition table for '${type}' declares no options`,
        );
      }
      for (const opt of options) {
        if (!canonical.has(opt.type)) {
          transitionError(
            climateProfileId,
            seasonId,
            `precipitation transition option type '${opt.type}' is not canonical`,
          );
        }
        if (!Number.isInteger(opt.weight) || opt.weight < 1) {
          transitionError(
            climateProfileId,
            seasonId,
            `precipitation transition option for '${type}' has non-positive weight`,
          );
        }
        const r = opt.intensityDriftRangeBp;
        if (
          !Number.isInteger(r.min) ||
          !Number.isInteger(r.max) ||
          r.min > r.max ||
          r.min < -10_000 ||
          r.max > 10_000
        ) {
          transitionError(
            climateProfileId,
            seasonId,
            `precipitation transition option for '${type}' has invalid intensityDriftRangeBp`,
          );
        }
      }
    }
  }
}

// Validate the declared transition policy surface of a profile/season so a
// missing or malformed policy fails closed (DESIGN-42 §1: "A missing climate or
// transition policy MUST fail with WEATHER_PROFILE_INCOMPLETE"), never silently
// skipping a drawn field.
function assertProfileComplete(input: StrategicWeatherGenerationInput, p: ClimateProfile): void {
  const seasonAssigned = p.seasonAssignment[input.month];
  if (seasonAssigned === undefined) {
    profileError(input, `no season assignment for month ${input.month}`);
  }
  if (p.seasons.length === 0) {
    profileError(input, "climate profile declares no seasons");
  }
  // Guard the required surfaces once, for the assigned season: any missing
  // declared table/policy element is a profile-incomplete failure.
  const season = p.seasons.find((s) => s.seasonId === seasonAssigned);
  if (!season) {
    profileError(input, `season ${seasonAssigned} not declared in climate profile`);
  }
  const ranges: [string, IntegerRange][] = [
    ["seaStateRange", season.seaStateRange],
    ["windSpeedRangeUmPerSec", season.windSpeedRangeUmPerSec],
    ["fogMistDensityRangeBp", season.fogMistDensityRangeBp],
    ["cloudCoverRangeBp", season.cloudCoverRangeBp],
    ["baseVisibilityRangeUm", season.baseVisibilityRangeUm],
  ];
  for (const [name, r] of ranges) {
    if (!Number.isInteger(r.min) || !Number.isInteger(r.max) || r.min < 0 || r.min > r.max) {
      profileError(input, `season ${seasonAssigned} ${name} is not a valid integer range`);
    }
  }
  if (season.windBands.length === 0) {
    profileError(input, `season ${seasonAssigned} declares no wind bands`);
  }
  for (const band of season.windBands) {
    if (!Number.isInteger(band.directionDeg) || band.directionDeg < 0 || band.directionDeg > 359) {
      profileError(
        input,
        `season ${seasonAssigned} wind band ${band.bandId} has invalid direction`,
      );
    }
    if (!Number.isInteger(band.weight) || band.weight < 1) {
      profileError(input, `season ${seasonAssigned} wind band ${band.bandId} has invalid weight`);
    }
  }
  if (season.precipitationOptions.length === 0) {
    profileError(input, `season ${seasonAssigned} declares no precipitation options`);
  }
  for (const opt of season.precipitationOptions) {
    if (!Number.isInteger(opt.weight) || opt.weight < 1) {
      profileError(input, `season ${seasonAssigned} precipitation option has invalid weight`);
    }
    if (
      !Number.isInteger(opt.intensityRangeBp.min) ||
      !Number.isInteger(opt.intensityRangeBp.max) ||
      opt.intensityRangeBp.min < 0 ||
      opt.intensityRangeBp.max > 10_000 ||
      opt.intensityRangeBp.min > opt.intensityRangeBp.max
    ) {
      profileError(input, `season ${seasonAssigned} precipitation option intensity range invalid`);
    }
  }
  // INC-3/§4 transition tables are part of the declared policy surface too:
  // a malformed table (undeclared band reference, weight/reachable mismatch)
  // fails closed at generation time as well as at first use (M3).
  validateSeasonTransitionTables(season, p.climateProfileId, season.seasonId);
}

// ---- Generation ----

export function generateStrategicWeather(
  input: StrategicWeatherGenerationInput,
): StrategicWeatherState {
  if (!input.climateProfile) {
    profileError(input, "missing climate profile");
  }
  const profile = input.climateProfile;
  assertProfileComplete(input, profile);

  const seasonId = profile.seasonAssignment[input.month] as string;
  const season = profile.seasons.find((s) => s.seasonId === seasonId) as SeasonClimateProfile;

  // Keyed, domain-separated stream (DESIGN-42 §1 / ADR-0022): campaign-level
  // weather decisions derive from the campaign seed + area + month, so the same
  // area/month always yields the same stream regardless of UI/battle/autoresolve
  // order, and different areas/months are fully separated.
  const stream = new RandomEngine(input.campaignSeed).stream(
    `campaign/weather/${input.areaId}/${input.month}`,
  );

  const inputHash = sha256Hex(
    canonicalSerialize({
      areaId: input.areaId,
      month: input.month,
      climateProfileId: profile.climateProfileId,
      seasonId,
      priorId: input.priorState?.stateHash ?? "",
    }),
  );

  // Fixed, documented draw order (exactly one stream draw per drawn field) so
  // generation is byte-identical across runs and processes.
  const seaState = drawUniform(
    stream,
    SafeInt(season.seaStateRange.min),
    SafeInt(season.seaStateRange.max),
  );

  const windBandIdx = drawWeightedId(stream, season.windBands);
  const windBand = season.windBands[windBandIdx] as WindBand;

  const windSpeedUmPerSec = drawUniform(
    stream,
    SafeInt(season.windSpeedRangeUmPerSec.min),
    SafeInt(season.windSpeedRangeUmPerSec.max),
  );

  const precipIdx = drawWeightedId(stream, season.precipitationOptions);
  const precipOption = season.precipitationOptions[precipIdx] as PrecipitationOption;

  const precipitationIntensityBp = drawUniform(
    stream,
    SafeInt(precipOption.intensityRangeBp.min),
    SafeInt(precipOption.intensityRangeBp.max),
  );

  const fogMistDensityBp = drawUniform(
    stream,
    SafeInt(season.fogMistDensityRangeBp.min),
    SafeInt(season.fogMistDensityRangeBp.max),
  );

  const cloudCoverBp = drawUniform(
    stream,
    SafeInt(season.cloudCoverRangeBp.min),
    SafeInt(season.cloudCoverRangeBp.max),
  );

  const baseVisibilityUm = drawUniform(
    stream,
    SafeInt(season.baseVisibilityRangeUm.min),
    SafeInt(season.baseVisibilityRangeUm.max),
  );

  // Record every keyed decision into the caller-provided ledger (port pattern;
  // ENGINEERING-CONTRACT: every random outcome records stream id, entity key,
  // phase, ruleset version, input hash, draw/derived value, outcome, reason).
  const ledger = input.randomLedger;
  if (ledger) {
    const record = (outcome: string, draw: number, entityKey: string, reasonCode: string) => {
      ledger.record({
        streamId: `campaign/weather/${input.areaId}/${input.month}`,
        entityKey,
        phase: WEATHER_GENERATION_PHASE,
        rulesetVersion: WEATHER_RULESET_VERSION,
        inputHash,
        draw,
        outcome,
        reasonCode,
      });
    };
    record(
      `sea_state_${String(seaState)}`,
      seaState as number,
      `${input.areaId}:${input.month}`,
      "SEA_STATE_DRAW",
    );
    record(
      `wind_band_${windBand.bandId}`,
      windBandIdx,
      `${input.areaId}:${input.month}`,
      "WIND_BAND_DRAW",
    );
    record(
      `wind_speed_ums_${String(windSpeedUmPerSec)}`,
      windSpeedUmPerSec as number,
      `${input.areaId}:${input.month}`,
      "WIND_SPEED_DRAW",
    );
    record(
      `precipitation_type_${precipOption.type}`,
      precipIdx,
      `${input.areaId}:${input.month}`,
      "PRECIPITATION_TYPE_DRAW",
    );
    record(
      `precipitation_intensity_bp_${String(precipitationIntensityBp)}`,
      precipitationIntensityBp as number,
      `${input.areaId}:${input.month}`,
      "PRECIPITATION_INTENSITY_DRAW",
    );
    record(
      `fog_mist_density_bp_${String(fogMistDensityBp)}`,
      fogMistDensityBp as number,
      `${input.areaId}:${input.month}`,
      "FOG_MIST_DENSITY_DRAW",
    );
    record(
      `cloud_cover_bp_${String(cloudCoverBp)}`,
      cloudCoverBp as number,
      `${input.areaId}:${input.month}`,
      "CLOUD_COVER_DRAW",
    );
    record(
      `base_visibility_um_${String(baseVisibilityUm)}`,
      baseVisibilityUm as number,
      `${input.areaId}:${input.month}`,
      "BASE_VISIBILITY_DRAW",
    );
  }

  return withStrategicWeatherStateHash({
    areaId: input.areaId,
    month: input.month,
    climateProfileId: profile.climateProfileId,
    seasonId,
    persistentWeatherStateId: input.priorState?.stateHash ?? "",
    seaState: seaState as number,
    windDirectionDeg: windBand.directionDeg,
    windSpeedUmPerSec: windSpeedUmPerSec as number,
    precipitationType: precipOption.type,
    precipitationIntensityBp: precipitationIntensityBp as number,
    fogMistDensityBp: fogMistDensityBp as number,
    cloudCoverBp: cloudCoverBp as number,
    daylightProfileId: season.daylightProfileId,
    glareEligible: season.glareEligible,
    baseVisibilityUm: baseVisibilityUm as number,
    generatedAtPhase: WEATHER_GENERATION_PHASE,
    rulesetVersion: WEATHER_RULESET_VERSION,
    climateVersion: profile.climateVersion,
    formulaVersion: WEATHER_FORMULA_VERSION,
    rngVersion: WEATHER_RNG_VERSION,
  });
}
