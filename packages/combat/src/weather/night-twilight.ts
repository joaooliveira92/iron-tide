import { BluewaveError } from "@bluewave/contracts";
import { type TimeOfDayState, TIME_OF_DAY_STATES } from "./constants.js";
import { WEATHER_PROFILE_INCOMPLETE } from "./reasonCodes.js";
import {
  DAYLIGHT_VIS_DAY_BP,
  DAYLIGHT_VIS_TWILIGHT_DAY_BP,
  DAYLIGHT_VIS_TWILIGHT_NIGHT_BP,
  DAYLIGHT_VIS_NIGHT_BP,
  DAYLIGHT_VIS_DUSK_DAWN_BP,
  DAYLIGHT_IDENTIFICATION_DAY_BP,
  DAYLIGHT_IDENTIFICATION_TWILIGHT_DAY_BP,
  DAYLIGHT_IDENTIFICATION_TWILIGHT_NIGHT_BP,
  DAYLIGHT_IDENTIFICATION_NIGHT_BP,
  DAYLIGHT_IDENTIFICATION_DUSK_DAWN_BP,
  DAYLIGHT_GUNNERY_DAY_BP,
  DAYLIGHT_GUNNERY_TWILIGHT_DAY_BP,
  DAYLIGHT_GUNNERY_TWILIGHT_NIGHT_BP,
  DAYLIGHT_GUNNERY_NIGHT_BP,
  DAYLIGHT_GUNNERY_DUSK_DAWN_BP,
  DAYLIGHT_AIR_OPS_DAY_BP,
  DAYLIGHT_AIR_OPS_TWILIGHT_DAY_BP,
  DAYLIGHT_AIR_OPS_TWILIGHT_NIGHT_BP,
  DAYLIGHT_AIR_OPS_NIGHT_BP,
  DAYLIGHT_AIR_OPS_DUSK_DAWN_BP,
  DAYLIGHT_ILLUMINATION_DAY_BP,
  DAYLIGHT_ILLUMINATION_TWILIGHT_DAY_BP,
  DAYLIGHT_ILLUMINATION_TWILIGHT_NIGHT_BP,
  DAYLIGHT_ILLUMINATION_NIGHT_BP,
  DAYLIGHT_ILLUMINATION_DUSK_DAWN_BP,
  SOLAR_BEARING_MIN_DEG,
  SOLAR_BEARING_MAX_DEG,
  SOLAR_ELEVATION_MIN_DEG,
  SOLAR_ELEVATION_MAX_DEG,
} from "./constants.js";

export interface DaylightProfileEntry {
  minuteOfDay: number;
  state: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
}

export interface DaylightProfile {
  daylightProfileId: string;
  entries: readonly DaylightProfileEntry[];
}

export interface TimeOfDayResult {
  timeOfDay: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
}

function profileError(daylightProfileId: string, reason: string): never {
  throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
    code: WEATHER_PROFILE_INCOMPLETE,
    daylightProfileId,
    reason,
  });
}

export function resolveTimeAndSolarGeometry(
  tacticalMinute: number,
  battleStartTimeMinutes: number,
  daylightProfile: DaylightProfile,
): TimeOfDayResult {
  const entries = daylightProfile.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    profileError(daylightProfile.daylightProfileId, "empty daylight profile");
  }
  if (entries[0]!.minuteOfDay !== 0 || entries[entries.length - 1]!.minuteOfDay !== 1440) {
    profileError(
      daylightProfile.daylightProfileId,
      "daylight profile must start at minuteOfDay 0 and end at the 1440 wrap sentinel",
    );
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (!Number.isInteger(e.minuteOfDay) || e.minuteOfDay < 0 || e.minuteOfDay > 1440) {
      profileError(daylightProfile.daylightProfileId, `entry ${i} has an invalid minuteOfDay`);
    }
    if (i > 0 && entries[i - 1]!.minuteOfDay >= e.minuteOfDay) {
      profileError(daylightProfile.daylightProfileId, "entries must be strictly ascending");
    }
    if (!(TIME_OF_DAY_STATES as readonly string[]).includes(e.state)) {
      profileError(
        daylightProfile.daylightProfileId,
        `entry ${i} has an unknown time-of-day state`,
      );
    }
    if (!Number.isFinite(e.solarBearingDeg) || !Number.isFinite(e.solarElevationDeg)) {
      profileError(daylightProfile.daylightProfileId, `entry ${i} has a non-finite solar field`);
    }
    if (
      !Number.isInteger(e.solarBearingDeg) ||
      e.solarBearingDeg < SOLAR_BEARING_MIN_DEG ||
      e.solarBearingDeg > SOLAR_BEARING_MAX_DEG
    ) {
      profileError(
        daylightProfile.daylightProfileId,
        `entry ${i} has a solar bearing outside the canonical 0..359 range`,
      );
    }
    if (
      !Number.isInteger(e.solarElevationDeg) ||
      e.solarElevationDeg < SOLAR_ELEVATION_MIN_DEG ||
      e.solarElevationDeg > SOLAR_ELEVATION_MAX_DEG
    ) {
      profileError(
        daylightProfile.daylightProfileId,
        `entry ${i} has a solar elevation outside the canonical -90..90 range`,
      );
    }
  }

  const currentMinute = (battleStartTimeMinutes + tacticalMinute) % 1440;

  let idx = entries.length - 1;
  for (let i = 0; i < entries.length - 1; i++) {
    const curr = entries[i]!;
    const next = entries[i + 1]!;
    if (currentMinute >= curr.minuteOfDay && currentMinute < next.minuteOfDay) {
      idx = i;
      break;
    }
  }

  const curr = entries[idx]!;
  const nextIdx = idx + 1 < entries.length ? idx + 1 : 0;
  const next = entries[nextIdx]!;

  if (currentMinute < curr.minuteOfDay || (nextIdx === 0 && currentMinute >= curr.minuteOfDay)) {
    return {
      timeOfDay: curr.state,
      solarBearingDeg: curr.solarBearingDeg,
      solarElevationDeg: curr.solarElevationDeg,
    };
  }

  const segLength = next.minuteOfDay - curr.minuteOfDay;
  const frac = segLength > 0 ? (currentMinute - curr.minuteOfDay) / segLength : 0;

  const interpolate = (a: number, b: number): number => {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    let result = a + frac * diff;
    if (result < 0) result += 360;
    if (result >= 360) result -= 360;
    return Math.round(result);
  };

  const interpolateElevation = (a: number, b: number): number => Math.round(a + frac * (b - a));

  const state = frac < 0.5 ? curr.state : next.state;

  return {
    timeOfDay: state,
    solarBearingDeg: interpolate(curr.solarBearingDeg, next.solarBearingDeg),
    solarElevationDeg: interpolateElevation(curr.solarElevationDeg, next.solarElevationDeg),
  };
}

export interface DaylightPolicyTable {
  visibilityMultiplierBp: number;
  identificationMultiplierBp: number;
  gunneryMultiplierBp: number;
  airOpsMultiplierBp: number;
  illuminationMultiplierBp: number;
}

export const DAYLIGHT_POLICY_TABLE: Record<TimeOfDayState, DaylightPolicyTable> = {
  DAY: {
    visibilityMultiplierBp: DAYLIGHT_VIS_DAY_BP,
    identificationMultiplierBp: DAYLIGHT_IDENTIFICATION_DAY_BP,
    gunneryMultiplierBp: DAYLIGHT_GUNNERY_DAY_BP,
    airOpsMultiplierBp: DAYLIGHT_AIR_OPS_DAY_BP,
    illuminationMultiplierBp: DAYLIGHT_ILLUMINATION_DAY_BP,
  },
  TWILIGHT_DAY: {
    visibilityMultiplierBp: DAYLIGHT_VIS_TWILIGHT_DAY_BP,
    identificationMultiplierBp: DAYLIGHT_IDENTIFICATION_TWILIGHT_DAY_BP,
    gunneryMultiplierBp: DAYLIGHT_GUNNERY_TWILIGHT_DAY_BP,
    airOpsMultiplierBp: DAYLIGHT_AIR_OPS_TWILIGHT_DAY_BP,
    illuminationMultiplierBp: DAYLIGHT_ILLUMINATION_TWILIGHT_DAY_BP,
  },
  TWILIGHT_NIGHT: {
    visibilityMultiplierBp: DAYLIGHT_VIS_TWILIGHT_NIGHT_BP,
    identificationMultiplierBp: DAYLIGHT_IDENTIFICATION_TWILIGHT_NIGHT_BP,
    gunneryMultiplierBp: DAYLIGHT_GUNNERY_TWILIGHT_NIGHT_BP,
    airOpsMultiplierBp: DAYLIGHT_AIR_OPS_TWILIGHT_NIGHT_BP,
    illuminationMultiplierBp: DAYLIGHT_ILLUMINATION_TWILIGHT_NIGHT_BP,
  },
  NIGHT: {
    visibilityMultiplierBp: DAYLIGHT_VIS_NIGHT_BP,
    identificationMultiplierBp: DAYLIGHT_IDENTIFICATION_NIGHT_BP,
    gunneryMultiplierBp: DAYLIGHT_GUNNERY_NIGHT_BP,
    airOpsMultiplierBp: DAYLIGHT_AIR_OPS_NIGHT_BP,
    illuminationMultiplierBp: DAYLIGHT_ILLUMINATION_NIGHT_BP,
  },
  DAWN_DUSK_TRANSITION: {
    visibilityMultiplierBp: DAYLIGHT_VIS_DUSK_DAWN_BP,
    identificationMultiplierBp: DAYLIGHT_IDENTIFICATION_DUSK_DAWN_BP,
    gunneryMultiplierBp: DAYLIGHT_GUNNERY_DUSK_DAWN_BP,
    airOpsMultiplierBp: DAYLIGHT_AIR_OPS_DUSK_DAWN_BP,
    illuminationMultiplierBp: DAYLIGHT_ILLUMINATION_DUSK_DAWN_BP,
  },
};

export function daylightVisibilityMultiplierBp(state: TimeOfDayState): number {
  return DAYLIGHT_POLICY_TABLE[state].visibilityMultiplierBp;
}

export function daylightIdentificationMultiplierBp(state: TimeOfDayState): number {
  return DAYLIGHT_POLICY_TABLE[state].identificationMultiplierBp;
}
