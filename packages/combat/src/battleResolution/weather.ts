// B-6 INC-2 (AC-3): build the battle weather from the battle area's COMMITTED
// `StrategicWeatherState` — one `BattleWeatherInitialization` (DESIGN-42 §2)
// plus the `WeatherEngineContext` the minute-advance engine consumes.
//
// Resolution rules (recorded in ADR-0026):
//  - climate profile: resolved by `strategicWeather.climateProfileId` from the
//    shipped profile registry (default climate profile `defaultClimateProfile_v1`
//    today); unknown id -> WEATHER_PROFILE_INCOMPLETE (fail-closed, matching
//    the strategic-generation engine's missing-profile policy).
//  - daylight profile: resolved by `strategicWeather.daylightProfileId` from the
//    shipped registry (`default_daylight_v1`); unknown id -> WEATHER_PROFILE_INCOMPLETE.
//  - local variation: LOCAL_VARIATION_POLICY_NONE — the committed strategic
//    state IS the battle's tactical weather source (auto-resolution and player
//    play may never reroll weather; same-source rule, DESIGN-42 §5/ADR-0022).
//  - battleDate = "<campaignMonth>-15", battleStartTime "06:00" (canonical
//    anchors, ADR-0026); solar geometry resolved from the daylight profile at
//    minute 0 so initialization matches the engine's minute-1 resolution.
import {
  initializeBattleWeather,
  type BattleWeatherInitialization,
} from "../weather/battle-init.js";
import { defaultClimateProfile_v1 } from "../weather/default-climate-profile.js";
import { type ClimateProfile } from "../weather/climate.js";
import { DEFAULT_DAYLIGHT_PROFILE_ID, defaultDaylightProfile_v1 } from "./daylight.js";
import { resolveTimeAndSolarGeometry, type DaylightProfile } from "../weather/night-twilight.js";
import { type WeatherEngineContext } from "../weather/engine.js";
import { type StrategicWeatherState } from "../weather/strategic-state.js";
import { LOCAL_VARIATION_POLICY_NONE } from "../weather/constants.js";
import { type RandomLedger } from "@bluewave/random";
import {
  AUTO_RESOLUTION_BATTLE_DATE_DAY,
  AUTO_RESOLUTION_BATTLE_START_MINUTES,
  AUTO_RESOLUTION_BATTLE_START_TIME,
  DEFAULT_AREA_BBOX,
} from "./constants.js";
import { BluewaveError } from "@bluewave/contracts";
import {
  WEATHER_PROFILE_INCOMPLETE,
  INVALID_BATTLE_WEATHER_INITIALIZATION,
} from "../weather/reasonCodes.js";

// Shipped profile registries (resolved by id; fail-closed on unknown).

const CLIMATE_PROFILES: Readonly<Record<string, ClimateProfile>> = Object.freeze({
  [defaultClimateProfile_v1.climateProfileId]: defaultClimateProfile_v1,
});

const DAYLIGHT_PROFILES: Readonly<Record<string, DaylightProfile>> = Object.freeze({
  [DEFAULT_DAYLIGHT_PROFILE_ID]: defaultDaylightProfile_v1,
});

/** Resolve a climate profile by id; unknown -> WEATHER_PROFILE_INCOMPLETE. */
export function resolveClimateProfile(climateProfileId: string): ClimateProfile {
  const profile = CLIMATE_PROFILES[climateProfileId];
  if (!profile) {
    throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
      code: WEATHER_PROFILE_INCOMPLETE,
      climateProfileId,
      reason: "no shipped climate profile for id — no silent fallback",
    });
  }
  return profile;
}

/** Resolve a daylight profile by id; unknown -> WEATHER_PROFILE_INCOMPLETE
 *  (module-private; the public registry lives in ./daylight.ts). */
function resolveDaylightProfile(daylightProfileId: string): DaylightProfile {
  const profile = DAYLIGHT_PROFILES[daylightProfileId];
  if (!profile) {
    throw new BluewaveError(WEATHER_PROFILE_INCOMPLETE, {
      code: WEATHER_PROFILE_INCOMPLETE,
      daylightProfileId,
      reason: "no shipped daylight profile for id — no silent fallback",
    });
  }
  return profile;
}

// Battle weather construction

export interface BattleWeatherInput {
  battleId: string;
  areaId: string;
  campaignMonth: string; // "1880-02" (DESIGN-42 stream domain)
  strategicWeather: StrategicWeatherState;
  battleSeed: string;
  randomLedger?: RandomLedger;
}

export interface BattleWeatherContext {
  /** The one immutable initialization (AC-3). */
  initialization: BattleWeatherInitialization;
  /** WeatherEngineContext consumed by advanceMinute.weather. */
  context: WeatherEngineContext;
  /** Canonical battle date ("YYYY-MM-15"). */
  battleDate: string;
}

export function buildBattleWeather(input: BattleWeatherInput): BattleWeatherContext {
  const { battleId, areaId, campaignMonth, battleSeed, randomLedger } = input;
  // AC-3 fail-closed: the committed strategic source is mandatory.
  if (!input.strategicWeather) {
    throw new BluewaveError(INVALID_BATTLE_WEATHER_INITIALIZATION, {
      code: INVALID_BATTLE_WEATHER_INITIALIZATION,
      battleId,
      areaId,
      reason: "battle auto-resolution requires the battle area's committed StrategicWeatherState",
    });
  }
  const strategic = input.strategicWeather;

  const climateProfile = resolveClimateProfile(strategic.climateProfileId);
  const daylightProfile = resolveDaylightProfile(strategic.daylightProfileId);
  const seasonId = strategic.seasonId;

  const battleDate = `${campaignMonth}-${String(AUTO_RESOLUTION_BATTLE_DATE_DAY).padStart(2, "0")}`;

  // Solar geometry at minute 0: same canonical resolution the engine uses at
  // minute 1 (determinism: initialization and engine agree on the profile).
  const solarGeometry = resolveTimeAndSolarGeometry(
    0,
    AUTO_RESOLUTION_BATTLE_START_MINUTES,
    daylightProfile,
  );

  const initialization = initializeBattleWeather({
    battleId,
    areaId,
    strategicWeatherState: strategic,
    battleDate,
    battleStartTime: AUTO_RESOLUTION_BATTLE_START_TIME,
    location: {
      areaId,
      xUm: Math.floor((DEFAULT_AREA_BBOX.minX + DEFAULT_AREA_BBOX.maxX) / 2),
      yUm: Math.floor((DEFAULT_AREA_BBOX.minY + DEFAULT_AREA_BBOX.maxY) / 2),
    },
    missionTemplateId: "standard_encounter_v1",
    localVariationPolicyId: LOCAL_VARIATION_POLICY_NONE,
    battleSeed,
    solarGeometry,
    randomLedger,
  });

  const context: WeatherEngineContext = {
    components: initialization.components,
    daylightProfile,
    climateProfile,
    seasonId,
    battleStartMinutes: AUTO_RESOLUTION_BATTLE_START_MINUTES,
    battleSeed,
    randomLedger,
  };

  return { initialization, context, battleDate };
}
