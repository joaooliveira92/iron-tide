//packages/combat/src/weather/progression.ts
// DESIGN-42 §4 tactical weather progression (INC-3/AC-5): exactly every 30
// tactical minutes the engine MAY transition precipitation, fog, cloud cover,
// wind, and visibility through the climate profile's declared transition tables
// and a keyed per-interval stream `battle/weather/interval/<n>` (n = interval
// index; ADR-0022 §8). Sea state changes by AT MOST 1 per interval regardless
// of the authored drift range (§4). Wind direction changes by at most one
// declared climate transition band. Each transition is recorded (INC-5/§28
// WeatherTransitionRecord) and every keyed draw is recorded into the optional
// RandomLedger port. A missing season or a malformed transition table fails
// closed with WEATHER_PROFILE_INCOMPLETE (never a silent no-op). Pure/
// deterministic: no ambient I/O/clock/random.
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

// ---- Minimal transition record (INC-5 will upgrade to full §28 WeatherEventRecord) ----
export interface WeatherTransitionRecord {
  tacticalMinute: number;
  intervalIndex: number;
  component: string;
  preValue: string; // string representation of pre-transition value
  postValue: string; // string representation of post-transition value
  reason: string;
}

// ---- Internal helpers ----

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

/**
 * Apply a drift range: draw one uniform value in [min, max], add to base, clamp.
 * When `maxAbsDelta` is supplied, the authority clamps the drawn drift itself
 * (e.g. §4 sea state may change by at most exactly 1 level per interval) before
 * adding it — authoritative law beats any wider authored range. Returns the
 * applied value together with the raw drawn drift (for the RandomLedger).
 */
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

/** Draw a precipitation transition: next type, intensity drift, and both raw
 *  draws (type index + intensity drift) for the RandomLedger. Consumes 2 draws
 *  only when a table entry exists for the current type. */
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

/** Draw a wind direction transition (plus the chosen band index for the ledger). */
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

// ---- Progression ----

export interface ProgressWeatherInput {
  components: BattleWeatherComponents;
  climateProfile: ClimateProfile;
  seasonId: string;
  /** The tactical minute this interval boundary occurs at (e.g., 30, 60, 90...). */
  tacticalMinute: number;
  /** Battle seed (derives the per-interval keyed stream). */
  battleSeed: string;
  /** Optional ledger recording every keyed random decision (port pattern). */
  randomLedger?: RandomLedger;
}

export interface ProgressWeatherResult {
  nextComponents: BattleWeatherComponents;
  transitions: WeatherTransitionRecord[];
}

/**
 * Advance the tactical weather components forward by one 30-minute interval.
 * The component draws come from the per-interval keyed stream
 * `battle/weather/interval/<n>` (n = interval index), so different intervals
 * draw DIFFERENT sequences (M2) — never the same sequence replayed at every
 * boundary. Draw consumption is NOT fixed-size: each component consumes its
 * draw(s) only when a transition table / drift-range entry exists for it (an
 * absent entry is the explicit no-transition policy of ADR-0022 §8, not a
 * consumed-and-discarded draw). Sea state is additionally law-clamped to at
 * most ±1 per interval (§4, M4). The declared season must exist in the profile
 * and its transition tables must be well-formed, or the call fails with
 * WEATHER_PROFILE_INCOMPLETE (M3).
 */
export function progressBattleWeatherComponents(
  input: ProgressWeatherInput,
): ProgressWeatherResult {
  const { components, climateProfile, seasonId, tacticalMinute, battleSeed } = input;
  const intervalIndex = Math.floor(tacticalMinute / TACTICAL_WEATHER_PROGRESSION_INTERVAL_MINUTES);

  // Find the season profile. A missing season is a profile-incomplete failure
  // (DESIGN-42 §1: "A missing climate or transition policy MUST fail with
  // WEATHER_PROFILE_INCOMPLETE") — never a silent no-op.
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
  // Malformed transition tables fail closed at first use (M3).
  validateSeasonTransitionTables(season, climateProfile.climateProfileId, seasonId);

  // Per-interval keyed stream (ADR-0022 §8): `battle/weather/interval/<n>`.
  // Rooted in the battle seed so different battles produce different
  // progression sequences, and suffixed with the interval index so every
  // interval draws its own sequence instead of replaying interval 1's draws.
  const streamId = `battle/weather/interval/${String(intervalIndex)}`;
  const stream = new RandomEngine(battleSeed).stream(streamId);

  // Deterministic record identity for the optional RandomLedger.
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

  // Fixed component draw order; per component the draw is consumed ONLY when
  // the component's table/drift entry exists (see doc comment above).
  // 1. Sea state drift — law-clamped to ±1 regardless of the authored range.
  let nextSeaState = components.seaState;
  if (season.seaStateDriftRange) {
    const driftResult = applyDrift(
      stream,
      components.seaState,
      season.seaStateDriftRange,
      SEA_STATE_MIN,
      SEA_STATE_MAX,
      /* maxAbsDelta */ 1 /* §4: at most one level per interval */,
    );
    nextSeaState = driftResult.value;
    recordDraw(driftResult.driftDraw, `sea_state_${String(nextSeaState)}`, "SEA_STATE_DRIFT_DRAW");
  }

  // 2. Precipitation type + intensity drift (2 draws only when a table entry
  //    exists for the current type).
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

  // 3. Wind direction band transition (1 draw when the current band has an entry).
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

  // 4. Wind speed drift.
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

  // 5. Fog density drift.
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

  // 6. Cloud cover drift.
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

  // 7. Base-visibility drift (consumed only when the season declares a range).
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

  // Build the next components.
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

  // Record transitions for changed components.
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
