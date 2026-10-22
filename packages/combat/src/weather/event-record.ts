import { createEnvelope } from "@bluewave/deterministic";
import { weatherPolicyId } from "./constants.js";
import type { WeatherTransitionRecord } from "./progression.js";

export type WeatherEventType = "weather_time_of_day" | "weather_progression" | "weather_visibility";

export interface WeatherEventRecord {
  eventId: string;
  battleId: string;
  minute: number;
  substep: number;
  eventType: WeatherEventType;
  preStateHash: string;
  postStateHash: string;
  visibilityUm: number;
  timeOfDay: string;
  solarBearingDeg: number;
  solarElevationDeg: number;
  progressionTransitions: readonly WeatherTransitionRecord[];
  formulaVersion: string;
  rulesetVersion: string;
  eventHash: string;
}

export function weatherEventId(o: {
  battleId: string;
  minute: number;
  substep: number;
  eventType: string;
}): string {
  return `${o.battleId}:${o.minute}:${o.substep}:${o.eventType}`;
}

export type WeatherEventRecordBody = Omit<WeatherEventRecord, "eventHash">;

export function computeWeatherEventHash(body: WeatherEventRecordBody): string {
  return createEnvelope("weather-event", weatherPolicyId, body).bodyHash;
}

export function makeWeatherEventRecord(seed: WeatherEventRecordBody): WeatherEventRecord {
  const eventHash = computeWeatherEventHash(seed);
  return { ...seed, eventHash };
}
