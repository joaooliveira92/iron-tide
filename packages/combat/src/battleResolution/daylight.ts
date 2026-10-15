//packages/combat/src/battleResolution/daylight.ts
// B-6 INC-2: the canonical shipped daylight profile `default_daylight_v1` and
// its id-based registry. The default climate profile (default-climate-profile.ts)
// references `daylightProfileId "default_daylight_v1"`; the auto-resolver must
// resolve that id to an actual DaylightProfile to build the weather-engine
// context. An unknown daylight-profile id fails closed with
// WEATHER_PROFILE_INCOMPLETE (same code night-twilight.ts uses for malformed
// profiles) — never a silent "always DAY" fallback (ADR-0022 §9).
import { BluewaveError } from "@bluewave/contracts";
import type { DaylightProfile, DaylightProfileEntry } from "../weather/night-twilight.js";
import { WEATHER_PROFILE_INCOMPLETE } from "../weather/reasonCodes.js";

export const DEFAULT_DAYLIGHT_PROFILE_ID = "default_daylight_v1" as const;

// Canonical 24h daylight profile used by auto-resolution (authored once,
// frozen; BALANCE TARGET shape recorded in ADR-0026). Entries: NIGHT before
// first light (00:00-05:00), TWILIGHT_DAY dawn (05:00-06:00), DAY (06:00-18:00),
// TWILIGHT_NIGHT dusk (18:00-19:00), NIGHT (19:00-24:00). Solar geometry is
// integer canonical angular units (bearing 0..359, elevation -90..90) at every
// entry including night (ADR-0022 §9 — no "not applicable" sentinel).
const entries: readonly DaylightProfileEntry[] = [
  { minuteOfDay: 0, state: "NIGHT", solarBearingDeg: 0, solarElevationDeg: -45 },
  { minuteOfDay: 300, state: "TWILIGHT_DAY", solarBearingDeg: 60, solarElevationDeg: -5 },
  { minuteOfDay: 360, state: "DAY", solarBearingDeg: 75, solarElevationDeg: 10 },
  { minuteOfDay: 1080, state: "DAY", solarBearingDeg: 240, solarElevationDeg: 35 },
  { minuteOfDay: 1140, state: "TWILIGHT_NIGHT", solarBearingDeg: 270, solarElevationDeg: -5 },
  { minuteOfDay: 1200, state: "NIGHT", solarBearingDeg: 315, solarElevationDeg: -30 },
  { minuteOfDay: 1440, state: "NIGHT", solarBearingDeg: 315, solarElevationDeg: -30 },
];

export const defaultDaylightProfile_v1: DaylightProfile = Object.freeze({
  daylightProfileId: DEFAULT_DAYLIGHT_PROFILE_ID,
  entries: Object.freeze(entries.map((e) => Object.freeze(e)) as readonly DaylightProfileEntry[]),
});

/** Resolve a daylight profile by id. Unknown id -> WEATHER_PROFILE_INCOMPLETE. */
export function resolveDaylightProfile(daylightProfileId: string): DaylightProfile {
  if (daylightProfileId === DEFAULT_DAYLIGHT_PROFILE_ID) {
    return defaultDaylightProfile_v1;
  }
  throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
    code: WEATHER_PROFILE_INCOMPLETE,
    daylightProfileId,
    reason: "no shipped daylight profile for id — no silent fallback",
  });
}
