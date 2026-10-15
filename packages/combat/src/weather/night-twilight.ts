//packages/combat/src/weather/night-twilight.ts
// DESIGN-42 §27 night/twilight model (INC-4/AC-10): five canonical states
// derived from battle date, location, tactical time, and canonical daylight
// profile. Each state supplies explicit optical visibility, identification,
// gunnery, air-operation, and illumination policies as versioned authored
// constants. Pure/deterministic: no ambient I/O/clock/random.
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

// ---- DaylightProfile ----

/**
 * One entry in a canonical daylight profile. The profile MUST cover a full
 * 24-hour period (entries must start at minuteOfDay=0 and end at 1440, sorted
 * ascending). The resolver finds the segment containing the current minute and
 * interpolates linearly between entries.
 */
export interface DaylightProfileEntry {
  /** Minutes since midnight (0..1440 exclusive). Entry 1440 is the end-of-day wrap sentinel. */
  minuteOfDay: number;
  /** Canonical time-of-day state at this entry. */
  state: TimeOfDayState;
  /** Solar bearing in integer degrees 0..359. Required at EVERY entry,
   *  including night: resolution feeds the component surface directly, which
   *  has no "not applicable" sentinel (SOLAR_BEARING_MIN_DEG = 0), so a -1 is
   *  a malformed profile (ADR-0022 §9). */
  solarBearingDeg: number;
  /** Solar elevation in integer degrees -90..90 (negative = below horizon). */
  solarElevationDeg: number;
}

export interface DaylightProfile {
  daylightProfileId: string;
  entries: readonly DaylightProfileEntry[];
}

// ---- Time-of-day resolver ----

export interface TimeOfDayResult {
  timeOfDay: TimeOfDayState;
  solarBearingDeg: number;
  solarElevationDeg: number;
}

/** Daylight-profile construction error: empty/malformed profile fails closed
 *  (DESIGN-42 preamble: runtime inference and silent fallback are prohibited).
 *  There is never a silently invented "always DAY" profile (M1). */
function profileError(daylightProfileId: string, reason: string): never {
  throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
    code: WEATHER_PROFILE_INCOMPLETE,
    daylightProfileId,
    reason,
  });
}

/**
 * Resolve the time-of-day / solar geometry for a given tactical minute.
 * The battle's start time in minutes-since-midnight is combined with the
 * tactical minute to find the current minute-of-day (modulo 1440).
 *
 * The daylight profile MUST be well-formed (non-empty, entries ascending from
 * minuteOfDay=0 to a 1440 wrap sentinel, valid canonical states, and canonical
 * solar geometry: integer bearing 0..359 and integer elevation -90..90 at every
 * entry); an absent or malformed profile fails with WEATHER_PROFILE_INCOMPLETE
 * instead of silently falling back (M1).
 *
 * @param tacticalMinute Minutes since battle start.
 * @param battleStartTimeMinutes Battle start time in minutes since midnight (0..1439).
 * @param daylightProfile Canonical daylight profile for the area/season.
 * @returns Resolved state + solar bearing + elevation.
 */
export function resolveTimeAndSolarGeometry(
  tacticalMinute: number,
  battleStartTimeMinutes: number,
  daylightProfile: DaylightProfile,
): TimeOfDayResult {
  const entries = daylightProfile.entries;
  // Fail closed on an absent/empty profile — never a silent DAY fallback (M1).
  if (!Array.isArray(entries) || entries.length === 0) {
    profileError(daylightProfile.daylightProfileId, "empty daylight profile");
  }
  // Structural malformation checks: coverage + ordering + field validity.
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
      // Fail closed on the old "-1 = not applicable (night)" sentinel (ADR-0022
      // §9): the components surface requires a canonical bearing
      // (SOLAR_BEARING_MIN_DEG = 0), so a sentinel profile would surface the
      // WRONG code (WEATHER_STATE_INVARIANT_FAILED) at the first engine
      // re-hash. A bearing outside 0..359 is a malformed profile instead.
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

  // Compute current minute-of-day (wrap every 1440).
  const currentMinute = (battleStartTimeMinutes + tacticalMinute) % 1440;

  // Find the segment containing currentMinute.
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

  // If we're before the first entry or past the last entry, wrap.
  if (currentMinute < curr.minuteOfDay || (nextIdx === 0 && currentMinute >= curr.minuteOfDay)) {
    return {
      timeOfDay: curr.state,
      solarBearingDeg: curr.solarBearingDeg,
      solarElevationDeg: curr.solarElevationDeg,
    };
  }

  // Linear interpolation between curr and next.
  const segLength = next.minuteOfDay - curr.minuteOfDay;
  const frac = segLength > 0 ? (currentMinute - curr.minuteOfDay) / segLength : 0;

  const interpolate = (a: number, b: number): number => {
    // ANGULAR (bearing) interpolation — the only interpolant that needs the
    // 360° wrap handling. NEVER applied to solar elevation: elevation is a
    // signed -90..90 quantity and wrapping it into 0..360 corrupts night hours
    // (e.g. -30° -> 330°).
    let diff = b - a;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    let result = a + frac * diff;
    if (result < 0) result += 360;
    if (result >= 360) result -= 360;
    return Math.round(result);
  };

  // Elevation interpolation is plain linear (no angular wrap).
  const interpolateElevation = (a: number, b: number): number => Math.round(a + frac * (b - a));

  // For state, pick the closer entry (first/last segment boundary).
  const state = frac < 0.5 ? curr.state : next.state;

  // Both entries were validated as canonical bearings (0..359), so the angular
  // interpolator always applies — the old "not applicable (-1)" fallback scheme
  // was removed (ADR-0022 §9). Elevation stays plain linear: wrapping a
  // negative elevation into 0..360 corrupts night hours (e.g. -30° -> 330°).
  return {
    timeOfDay: state,
    solarBearingDeg: interpolate(curr.solarBearingDeg, next.solarBearingDeg),
    solarElevationDeg: interpolateElevation(curr.solarElevationDeg, next.solarElevationDeg),
  };
}

// ---- Per-state policy tables (§27: visibility, identification, gunnery, air, illumination) ----

export interface DaylightPolicyTable {
  visibilityMultiplierBp: number;
  identificationMultiplierBp: number;
  gunneryMultiplierBp: number;
  airOpsMultiplierBp: number;
  illuminationMultiplierBp: number;
}

// Shipped versioned per-state policy table (weather_environment_v1).
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

/** Look up the per-state daylight policy for visibility multiplier. */
export function daylightVisibilityMultiplierBp(state: TimeOfDayState): number {
  return DAYLIGHT_POLICY_TABLE[state].visibilityMultiplierBp;
}

/** Look up the per-state daylight policy for identification multiplier. */
export function daylightIdentificationMultiplierBp(state: TimeOfDayState): number {
  return DAYLIGHT_POLICY_TABLE[state].identificationMultiplierBp;
}
