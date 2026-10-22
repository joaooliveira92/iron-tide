import { BluewaveError } from "@bluewave/contracts";
import type { DaylightProfile, DaylightProfileEntry } from "../weather/night-twilight.js";
import { WEATHER_PROFILE_INCOMPLETE } from "../weather/reasonCodes.js";

export const DEFAULT_DAYLIGHT_PROFILE_ID = "default_daylight_v1" as const;

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
