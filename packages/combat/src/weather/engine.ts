import type { BattleEvent } from "../core/battleLedger.js";
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
  components: BattleWeatherComponents;
  daylightProfile: DaylightProfile;
  climateProfile: ClimateProfile;
  seasonId: string;
  battleStartMinutes: number;
  battleSeed: string;
  randomLedger?: RandomLedger;
}

export interface ResolveWeatherInput {
  context: WeatherEngineContext;
  battleId: string;
  minute: number;
}

export interface ResolveWeatherResult {
  nextComponents: BattleWeatherComponents;
  ledgerEvents: BattleEvent[];
  weatherRecords: ReturnType<typeof makeWeatherEventRecord>[];
  visibilityUm: number;
}

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

export function resolveWeather(input: ResolveWeatherInput): ResolveWeatherResult {
  const { context, battleId, minute } = input;
  const { daylightProfile, climateProfile, seasonId, battleStartMinutes, battleSeed } = context;
  let components = context.components;

  const todPreHash = components.stateHash;
  const ledgerEvents: BattleEvent[] = [];
  const weatherRecords: ReturnType<typeof makeWeatherEventRecord>[] = [];

  const solarResult = resolveTimeAndSolarGeometry(minute, battleStartMinutes, daylightProfile);

  const timeOfDayChanged = solarResult.timeOfDay !== components.timeOfDay;

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

  const daylightMultiplierBp = daylightVisibilityMultiplierBp(components.timeOfDay);
  const fogMultiplierBp = computeFogVisibilityMultiplierBp(components.fogMistDensityBp);
  const precipMultiplierBp = computePrecipitationVisibilityMultiplierBp(
    components.precipitationType,
    components.precipitationIntensityBp,
  );

  const glareMultiplierBp = GLARE_NEUTRAL_MULTIPLIER_BP;

  const smokeMultiplierBp = 10_000;

  const visibilityResult = computeEffectiveVisibility({
    baseVisibilityUm: components.baseVisibilityUm,
    precipitationMultiplierBp: precipMultiplierBp,
    fogMultiplierBp,
    daylightMultiplierBp,
    glareMultiplierBp,
    smokeMultiplierBp,
  });

  const visibilityPreHash = components.stateHash;

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

  for (const wr of weatherRecords) {
    ledgerEvents.push(evt(wr.minute, wr.substep, wr.eventType, 7.5, "weather", battleId, ""));
  }

  return {
    nextComponents: components,
    ledgerEvents,
    weatherRecords,
    visibilityUm: visibilityResult.effectiveVisibilityUm,
  };
}
