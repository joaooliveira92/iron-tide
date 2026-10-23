import { initializeBattleWeather, type BattleWeatherInitialization } from "./battle-init.js";
import { defaultClimateProfile_v1 } from "./default-climate-profile.js";
import { type ClimateProfile } from "./climate.js";
import {
  DEFAULT_DAYLIGHT_PROFILE_ID,
  defaultDaylightProfile_v1,
} from "./default-daylight-profile.js";
import { resolveTimeAndSolarGeometry, type DaylightProfile } from "./night-twilight.js";
import { type WeatherEngineContext } from "./engine.js";
import { type StrategicWeatherState } from "./strategic-state.js";
import { LOCAL_VARIATION_POLICY_NONE } from "./constants.js";
import { type RandomLedger } from "@bluewave/random";
import {
  AUTO_RESOLUTION_BATTLE_DATE_DAY,
  AUTO_RESOLUTION_BATTLE_START_MINUTES,
  AUTO_RESOLUTION_BATTLE_START_TIME,
  DEFAULT_AREA_BBOX,
} from "./auto-resolution-battle-defaults.js";
import { BluewaveError } from "@bluewave/contracts";
import {
  WEATHER_PROFILE_INCOMPLETE,
  INVALID_BATTLE_WEATHER_INITIALIZATION,
} from "./reasonCodes.js";

const CLIMATE_PROFILES: Readonly<Record<string, ClimateProfile>> = Object.freeze({
  [defaultClimateProfile_v1.climateProfileId]: defaultClimateProfile_v1,
});

const DAYLIGHT_PROFILES: Readonly<Record<string, DaylightProfile>> = Object.freeze({
  [DEFAULT_DAYLIGHT_PROFILE_ID]: defaultDaylightProfile_v1,
});

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

export interface BattleWeatherInput {
  battleId: string;
  areaId: string;
  campaignMonth: string;
  strategicWeather: StrategicWeatherState;
  battleSeed: string;
  randomLedger?: RandomLedger;
}

export interface BattleWeatherContext {
  initialization: BattleWeatherInitialization;
  context: WeatherEngineContext;
  battleDate: string;
}

export function buildBattleWeather(input: BattleWeatherInput): BattleWeatherContext {
  const { battleId, areaId, campaignMonth, battleSeed, randomLedger } = input;
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
