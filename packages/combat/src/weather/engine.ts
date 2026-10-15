// DESIGN-42 §4/§5/§27/§28 — `resolveWeather` engine stage that runs each
// tactical minute before spotting (step between B-2 step 7 and step 8).
// Pure/deterministic: computes time-of-day, visibility distance, and every 30
// minutes tactical weather progression. Emits BattleEvent records through the
// caller-provided ledger. Strict no-op when no weather context is supplied
// (zero events, unchanged minute hashes).
import type { BattleEvent } from "../battleLedger.js";
import type { RandomLedger } from "@bluewave/random";
import { withTacticalWeatherComponentsHash } from "./components.js";
import type { BattleWeatherComponents } from "./components.js";
import type { ClimateProfile } from "./climate.js";
import type { DaylightProfile } from "./night-twilight.js";
import { resolveTimeAndSolarGeometry, daylightVisibilityMultiplierBp } from "./night-twilight.js";
import { progressBattleWeatherComponents, type WeatherTransitionRecord } from "./progression.js";
import { computeEffectiveVisibility } from "./visibility.js";
import { computeFogVisibilityMultiplierBp } from "./fog.js";
import { computePrecipitationVisibilityMultiplierBp } from "./precipitation.js";
import { makeWeatherEventRecord, weatherEventId } from "./event-record.js";
import {
  WEATHER_RULESET_VERSION,
  WEATHER_FORMULA_VERSION,
  GLARE_NEUTRAL_MULTIPLIER_BP,
} from "./constants.js";

export interface WeatherEngineContext {
  /** Current tactical weather components (immutable copy-out pattern). */
  components: BattleWeatherComponents;
  daylightProfile: DaylightProfile;
  climateProfile: ClimateProfile;
  seasonId: string;
  /** Battle start time in minutes since midnight (0..1439). */
  battleStartMinutes: number;
  /** Battle seed for deterministic progression. */
  battleSeed: string;
  /** Optional ledger recording every keyed random decision (port pattern; see
   *  ADR-0022 — tactical progression draws). */
  randomLedger?: RandomLedger;
}

export interface ResolveWeatherInput {
  context: WeatherEngineContext;
  battleId: string;
  minute: number;
}

export interface ResolveWeatherResult {
  /** Updated weather components (after time-of-day / progression). */
  nextComponents: BattleWeatherComponents;
  /** BattleEvents to append to the caller's BattleLedger. */
  ledgerEvents: BattleEvent[];
  /** Detailed weather event records (diagnostic / audit). */
  weatherRecords: ReturnType<typeof makeWeatherEventRecord>[];
  /** Current effective visibility distance in micrometres. */
  visibilityUm: number;
}

// Deterministic event helper, matching the pattern in simulation/engine.ts.
function evt(
  minute: number,
  substep: number,
  eventType: string,
  priority: number,
  actorId: string,
  battleId: string,
  targetId = "",
): BattleEvent {
  const eventId = `${battleId}:${minute}:${substep}:${eventType}:${actorId}:${targetId}`;
  return {
    battleId,
    minute,
    substep,
    eventPriority: priority,
    actorId,
    targetId,
    eventId,
    eventType,
  };
}

/**
 * Resolve the weather for one tactical minute. Steps:
 * 1. Recompute time-of-day / solar geometry (changes every minute).
 * 2. Every 30 minutes: tactical weather progression via climate transition tables.
 * 3. Recompute the effective visibility distance using all five multipliers.
 *
 * Returns updated components, ledger events, detail records, and visibility.
 * At minimum one weather_visibility event is emitted per minute (§28: every
 * visibility result creates a record). Time-of-day changes and progression
 * transitions emit additional records.
 */
export function resolveWeather(input: ResolveWeatherInput): ResolveWeatherResult {
  const { context, battleId, minute } = input;
  const { daylightProfile, climateProfile, seasonId, battleStartMinutes, battleSeed } = context;
  let components = context.components;

  // Pre-TOD hash: the state the TOD update departs from (authoritative for the
  // weather_time_of_day event's preStateHash).
  const todPreHash = components.stateHash;
  const ledgerEvents: BattleEvent[] = [];
  const weatherRecords: ReturnType<typeof makeWeatherEventRecord>[] = [];

  // --- Step 1: Time-of-day resolution (every minute) ---
  const solarResult = resolveTimeAndSolarGeometry(minute, battleStartMinutes, daylightProfile);

  const timeOfDayChanged = solarResult.timeOfDay !== components.timeOfDay;

  // Re-hash AFTER the TOD update (H1): spreading the new solar fields over the
  // old components object and keeping its stateHash would leave a hash of the
  // PRE-TOD surface. Recompute the authoritative hash for the updated surface
  // so every later stage carries a stateHash matching its own fields.
  components = withTacticalWeatherComponentsHash({
    ...components,
    timeOfDay: solarResult.timeOfDay,
    solarBearingDeg: solarResult.solarBearingDeg,
    solarElevationDeg: solarResult.solarElevationDeg,
  });

  if (timeOfDayChanged) {
    const todEvent = makeWeatherEventRecord({
      eventId: weatherEventId({
        battleId,
        minute,
        substep: 0,
        eventType: "weather_time_of_day",
      }),
      battleId,
      minute,
      substep: 0,
      eventType: "weather_time_of_day",
      preStateHash: todPreHash,
      postStateHash: components.stateHash,
      visibilityUm: 0,
      timeOfDay: solarResult.timeOfDay,
      solarBearingDeg: solarResult.solarBearingDeg,
      solarElevationDeg: solarResult.solarElevationDeg,
      progressionTransitions: [],
      formulaVersion: "weather_environment_v1",
      rulesetVersion: WEATHER_RULESET_VERSION,
    });
    weatherRecords.push(todEvent);
  }

  // --- Step 2: 30-minute tactical progression ---
  // Hash of the components ACTUALLY fed into progression — i.e. AFTER the TOD
  // update (H1): every later record's preStateHash is the state at that stage.
  const progressionPreHash = components.stateHash;
  let progressionRecords: WeatherTransitionRecord[] = [];
  if (minute % 30 === 0 && minute > 0) {
    const progResult = progressBattleWeatherComponents({
      components,
      climateProfile,
      seasonId,
      tacticalMinute: minute,
      battleSeed,
      randomLedger: context.randomLedger,
    });
    progressionRecords = progResult.transitions;
    if (progResult.transitions.length > 0) {
      components = progResult.nextComponents;
      const progEvent = makeWeatherEventRecord({
        eventId: weatherEventId({
          battleId,
          minute,
          substep: 0,
          eventType: "weather_progression",
        }),
        battleId,
        minute,
        substep: 0,
        eventType: "weather_progression",
        preStateHash: progressionPreHash,
        postStateHash: components.stateHash,
        visibilityUm: 0,
        timeOfDay: solarResult.timeOfDay,
        solarBearingDeg: solarResult.solarBearingDeg,
        solarElevationDeg: solarResult.solarElevationDeg,
        progressionTransitions: progressionRecords,
        formulaVersion: WEATHER_FORMULA_VERSION,
        rulesetVersion: WEATHER_RULESET_VERSION,
      });
      weatherRecords.push(progEvent);
    }
  }

  // The visibility stage below runs on the post-progression components when
  // progression fired; visibility computation does not mutate the components.

  // --- Step 3: Visibility distance computation (every minute — §28: every
  // visibility result creates an immutable record). ---
  const daylightMultiplierBp = daylightVisibilityMultiplierBp(components.timeOfDay);
  const fogMultiplierBp = computeFogVisibilityMultiplierBp(components.fogMistDensityBp);
  const precipMultiplierBp = computePrecipitationVisibilityMultiplierBp(
    components.precipitationType,
    components.precipitationIntensityBp,
  );

  // Glare multiplier at the per-minute level: glareIntensityBp is always 0 this
  // slice (no resolved directional geometry at initialization; smoke deferred),
  // so the per-minute visibility formula uses the neutral multiplier. Directional
  // per-observation glare is owned by the glare module (INC-4) during spotting
  // and is never approximated with a component-level 1:1 multiplier here (L6).
  const glareMultiplierBp = GLARE_NEUTRAL_MULTIPLIER_BP;

  // Smoke multiplier: neutral 10_000 (smoke deferred to M3).
  const smokeMultiplierBp = 10_000;

  const visibilityResult = computeEffectiveVisibility({
    baseVisibilityUm: components.baseVisibilityUm,
    precipitationMultiplierBp: precipMultiplierBp,
    fogMultiplierBp,
    daylightMultiplierBp,
    glareMultiplierBp,
    smokeMultiplierBp,
  });

  // Visibility does not mutate the components, so pre == post == the current
  // authoritative state hash.
  const visibilityPreHash = components.stateHash;

  // Emit a weather_visibility event every minute (§28: every visibility
  // result creates an immutable record).
  const visibilityEvent = makeWeatherEventRecord({
    eventId: weatherEventId({
      battleId,
      minute,
      substep: 0,
      eventType: "weather_visibility",
    }),
    battleId,
    minute,
    substep: 0,
    eventType: "weather_visibility",
    preStateHash: visibilityPreHash,
    postStateHash: components.stateHash,
    visibilityUm: visibilityResult.effectiveVisibilityUm,
    timeOfDay: components.timeOfDay,
    solarBearingDeg: components.solarBearingDeg,
    solarElevationDeg: components.solarElevationDeg,
    progressionTransitions: [],
    formulaVersion: WEATHER_FORMULA_VERSION,
    rulesetVersion: WEATHER_RULESET_VERSION,
  });
  weatherRecords.push(visibilityEvent);

  // Each record's pre/post hashes were set from the components surface at that
  // stage, so no post-hoc re-hash pass is needed. All event hashes are already
  // authoritative (computed at construction).

  // Create ledger BattleEvents for each weather event.
  for (const wr of weatherRecords) {
    ledgerEvents.push(
      evt(
        wr.minute,
        wr.substep,
        wr.eventType,
        7.5, // priority between collision (7) and spotting (8)
        "weather",
        battleId,
        "",
      ),
    );
  }

  return {
    nextComponents: components,
    ledgerEvents,
    weatherRecords,
    visibilityUm: visibilityResult.effectiveVisibilityUm,
  };
}
