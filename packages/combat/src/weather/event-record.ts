// DESIGN-42 §28 WeatherEventRecord — immutable record produced by every weather
// transition, time-of-day change, visibility computation, and progression step.
// Mirrors the GunneryEventRecord / DamageEventRecord pattern.
import { createEnvelope } from "@bluewave/deterministic";
import { weatherPolicyId } from "./constants.js";
import type { WeatherTransitionRecord } from "./progression.js";

export type WeatherEventType = "weather_time_of_day" | "weather_progression" | "weather_visibility";

export interface WeatherEventRecord {
  /** Stable event identifier (derived from battle, minute, substep, type). */
  eventId: string;
  battleId: string;
  minute: number;
  substep: number;
  eventType: WeatherEventType;
  /** Pre-transition component state hash ("" for new-state-only events). */
  preStateHash: string;
  /** Post-transition component state hash. */
  postStateHash: string;
  /** Effective visibility distance in micrometres (0 if not computed this event). */
  visibilityUm: number;
  /** Resolved time-of-day state. */
  timeOfDay: string;
  /** Solar bearing at this event (degrees). */
  solarBearingDeg: number;
  /** Solar elevation at this event (degrees). */
  solarElevationDeg: number;
  /** Embedded progression transition details (empty for non-progression events). */
  progressionTransitions: readonly WeatherTransitionRecord[];
  formulaVersion: string;
  rulesetVersion: string;
  /** Authoritative event hash (deterministic). */
  eventHash: string;
}

// Canonical event id.
export function weatherEventId(o: {
  battleId: string;
  minute: number;
  substep: number;
  eventType: string;
}): string {
  return `${o.battleId}:${o.minute}:${o.substep}:${o.eventType}`;
}

// Body for hash computation (excludes eventHash).
export type WeatherEventRecordBody = Omit<WeatherEventRecord, "eventHash">;

export function computeWeatherEventHash(body: WeatherEventRecordBody): string {
  return createEnvelope("weather-event", weatherPolicyId, body).bodyHash;
}

export function makeWeatherEventRecord(seed: WeatherEventRecordBody): WeatherEventRecord {
  const eventHash = computeWeatherEventHash(seed);
  return { ...seed, eventHash };
}
