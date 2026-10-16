// AC-10: Night/twilight — five canonical states (§27) derived from battle
// date/location/tactical time/daylight profile; each state supplies explicit
// optical visibility, identification, gunnery, air-op, and illumination policies.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  resolveTimeAndSolarGeometry,
  daylightVisibilityMultiplierBp,
  daylightIdentificationMultiplierBp,
  DAYLIGHT_POLICY_TABLE,
  type DaylightProfile,
} from "../../src/weather/night-twilight.js";
import { WEATHER_PROFILE_INCOMPLETE } from "../../src/weather/reasonCodes.js";
import { TIME_OF_DAY_STATES } from "../../src/weather/constants.js";

// Author a test daylight profile: summer solstice at 51°N, London.
const testProfile: DaylightProfile = {
  daylightProfileId: "summer_solstice_51N_v1",
  entries: [
    {
      minuteOfDay: 0,
      state: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -30,
    },
    {
      minuteOfDay: 240,
      state: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -20,
    },
    {
      minuteOfDay: 300,
      state: "DAWN_DUSK_TRANSITION",
      solarBearingDeg: 0,
      solarElevationDeg: -5,
    },
    {
      minuteOfDay: 330,
      state: "TWILIGHT_NIGHT",
      solarBearingDeg: 30,
      solarElevationDeg: 2,
    },
    {
      minuteOfDay: 360,
      state: "TWILIGHT_DAY",
      solarBearingDeg: 45,
      solarElevationDeg: 10,
    },
    {
      minuteOfDay: 390,
      state: "DAY",
      solarBearingDeg: 60,
      solarElevationDeg: 20,
    },
    {
      minuteOfDay: 720,
      state: "DAY",
      solarBearingDeg: 180,
      solarElevationDeg: 60,
    },
    {
      minuteOfDay: 1080,
      state: "DAY",
      solarBearingDeg: 270,
      solarElevationDeg: 30,
    },
    {
      minuteOfDay: 1260,
      state: "TWILIGHT_DAY",
      solarBearingDeg: 300,
      solarElevationDeg: 5,
    },
    {
      minuteOfDay: 1320,
      state: "TWILIGHT_NIGHT",
      solarBearingDeg: 310,
      solarElevationDeg: -2,
    },
    {
      minuteOfDay: 1380,
      state: "DAWN_DUSK_TRANSITION",
      solarBearingDeg: 0,
      solarElevationDeg: -10,
    },
    {
      minuteOfDay: 1410,
      state: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -18,
    },
    {
      minuteOfDay: 1440,
      state: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -30,
    },
  ],
};

describe("AC-10: night/twilight model (§27)", () => {
  it("resolves DAY state at noon", () => {
    const result = resolveTimeAndSolarGeometry(
      0, // tactical minute
      720, // battle start at noon (12:00 = minute 720)
      testProfile,
    );
    expect(result.timeOfDay).toBe("DAY");
    expect(result.solarBearingDeg).toBe(180);
    expect(result.solarElevationDeg).toBe(60);
  });

  it("resolves NIGHT state at midnight", () => {
    const result = resolveTimeAndSolarGeometry(
      0,
      0, // battle start at midnight
      testProfile,
    );
    expect(result.timeOfDay).toBe("NIGHT");
  });

  it("resolves TWILIGHT state at dawn boundary", () => {
    // Dawn: minute 330 → TWILIGHT_NIGHT → 360 → TWILIGHT_DAY → 390 → DAY
    const dawnTwilight = resolveTimeAndSolarGeometry(0, 350, testProfile);
    expect(dawnTwilight.timeOfDay).toMatch(/^TWILIGHT/);
  });

  it("advancing tactical minutes transitions through states", () => {
    // Start at 5:50 (350 min), advance through dawn
    const t0 = resolveTimeAndSolarGeometry(0, 350, testProfile);
    const t1 = resolveTimeAndSolarGeometry(10, 350, testProfile); // 360 → TWILIGHT_DAY
    const t2 = resolveTimeAndSolarGeometry(40, 350, testProfile); // 390 → DAY

    expect(t0.timeOfDay).toMatch(/^TWILIGHT/);
    expect(t1.timeOfDay).toBe("TWILIGHT_DAY");
    expect(t2.timeOfDay).toBe("DAY");
  });

  it("resolves solar geometry with interpolation in twilight band", () => {
    const result = resolveTimeAndSolarGeometry(0, 345, testProfile); // midway between 330 and 360
    expect(result.solarBearingDeg).toBeGreaterThanOrEqual(30);
    expect(result.solarBearingDeg).toBeLessThanOrEqual(45);
    expect(result.solarElevationDeg).toBeGreaterThanOrEqual(2);
    expect(result.solarElevationDeg).toBeLessThanOrEqual(10);
  });

  it("NIGHT->NIGHT interpolation keeps solar elevation negative (no 360° wrap)", () => {
    // Regression (ADR-0022 §9): the old angular interpolator wrapped valid
    // negative elevations into 0..360 (e.g. -30° -> 330°), corrupting night
    // hours. Elevation is plain linear. Battle starts at midnight; minute 120
    // sits midway between the 0:00 NIGHT entry (-30°) and the 4:00 NIGHT
    // entry (-20°).
    const result = resolveTimeAndSolarGeometry(120, 0, testProfile);
    expect(result.timeOfDay).toBe("NIGHT");
    expect(result.solarElevationDeg).toBe(-25);
    expect(result.solarElevationDeg).toBeLessThan(0);
  });

  it("all five canonical time-of-day states have explicit policies", () => {
    for (const state of TIME_OF_DAY_STATES) {
      const policy = DAYLIGHT_POLICY_TABLE[state];
      expect(policy).toBeDefined();
      expect(typeof policy.visibilityMultiplierBp).toBe("number");
      expect(typeof policy.identificationMultiplierBp).toBe("number");
      expect(typeof policy.gunneryMultiplierBp).toBe("number");
      expect(typeof policy.airOpsMultiplierBp).toBe("number");
      expect(typeof policy.illuminationMultiplierBp).toBe("number");
    }
  });

  it("DAY has highest visibility multiplier (10_000)", () => {
    expect(daylightVisibilityMultiplierBp("DAY")).toBe(10_000);
  });

  it("NIGHT has lowest visibility multiplier (3_500)", () => {
    expect(daylightVisibilityMultiplierBp("NIGHT")).toBe(3_500);
  });

  it("TWILIGHT_DAY visibility is between DAY and NIGHT (9_000)", () => {
    expect(daylightVisibilityMultiplierBp("TWILIGHT_DAY")).toBe(9_000);
  });

  it("identification multiplier for NIGHT is lowest (2_000)", () => {
    expect(daylightIdentificationMultiplierBp("NIGHT")).toBe(2_000);
  });

  it("gunnery multiplier for DAY is 10_000", () => {
    expect(DAYLIGHT_POLICY_TABLE.DAY.gunneryMultiplierBp).toBe(10_000);
  });

  it("air-ops multiplier for DAY is 10_000", () => {
    expect(DAYLIGHT_POLICY_TABLE.DAY.airOpsMultiplierBp).toBe(10_000);
  });

  it("illumination multiplier for NIGHT is 2_000", () => {
    expect(DAYLIGHT_POLICY_TABLE.NIGHT.illuminationMultiplierBp).toBe(2_000);
  });

  // ---- M1: absent/malformed daylight profile fails closed ----
  it("empty daylight profile fails closed with WEATHER_PROFILE_INCOMPLETE (no silent DAY)", () => {
    let caught: unknown;
    try {
      resolveTimeAndSolarGeometry(0, 720, {
        daylightProfileId: "empty",
        entries: [],
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
  });

  it("profile not covering the full 24h period fails closed", () => {
    const partial: DaylightProfile = {
      daylightProfileId: "partial",
      entries: [
        {
          minuteOfDay: 0,
          state: "NIGHT",
          solarBearingDeg: 0,
          solarElevationDeg: -30,
        },
        {
          minuteOfDay: 300,
          state: "DAY",
          solarBearingDeg: 90,
          solarElevationDeg: 20,
        },
        // no 1440 wrap sentinel
      ],
    };
    expect(() => resolveTimeAndSolarGeometry(0, 720, partial)).toThrow(BluewaveError);
  });

  it("descending/unsorted entries fail closed", () => {
    const bad: DaylightProfile = {
      daylightProfileId: "bad",
      entries: [
        {
          minuteOfDay: 0,
          state: "NIGHT",
          solarBearingDeg: 0,
          solarElevationDeg: -30,
        },
        {
          minuteOfDay: 1440,
          state: "NIGHT",
          solarBearingDeg: 0,
          solarElevationDeg: -30,
        },
        {
          minuteOfDay: 300,
          state: "DAY",
          solarBearingDeg: 90,
          solarElevationDeg: 20,
        },
      ],
    };
    expect(() => resolveTimeAndSolarGeometry(0, 720, bad)).toThrow(BluewaveError);
  });

  it("'not applicable' bearing (-1) fails closed with WEATHER_PROFILE_INCOMPLETE", () => {
    // Regression (ADR-0022 §9): the old profile schema allowed a -1 bearing
    // sentinel for night entries, but the components contract enforces
    // SOLAR_BEARING_MIN_DEG = 0, so -1 died at the first re-hash with the
    // WRONG code (WEATHER_STATE_INVARIANT_FAILED). The resolver must treat the
    // malformed profile itself as WEATHER_PROFILE_INCOMPLETE. Both adjacent
    // entries are -1, exactly the reported scheme-vs-guard mismatch.
    const bad: DaylightProfile = {
      daylightProfileId: "night_no_sun",
      entries: [
        {
          minuteOfDay: 0,
          state: "NIGHT",
          solarBearingDeg: -1,
          solarElevationDeg: -30,
        },
        {
          minuteOfDay: 1440,
          state: "NIGHT",
          solarBearingDeg: -1,
          solarElevationDeg: -30,
        },
      ],
    };
    let caught: unknown;
    try {
      resolveTimeAndSolarGeometry(0, 0, bad);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(WEATHER_PROFILE_INCOMPLETE);
  });
});
