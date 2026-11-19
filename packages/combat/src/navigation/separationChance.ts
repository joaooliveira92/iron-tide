import { computeFogVisibilityMultiplierBp } from "../weather/fog.js";
import { daylightVisibilityMultiplierBp } from "../weather/night-twilight.js";
import { computePrecipitationVisibilityMultiplierBp } from "../weather/precipitation.js";
import { computeEffectiveVisibility } from "../weather/visibility.js";
import { GLARE_NEUTRAL_MULTIPLIER_BP } from "../weather/constants.js";
import type { BattleWeatherComponents } from "../weather/components.js";
import {
  NAVIGATION_BASIS_POINTS,
  type NavigationSeparationRules,
  type SeparableFormation,
} from "./model.js";

export interface SeparationWeather {
  readonly night: boolean;
  readonly visibilityUm: number | undefined;
}

export function separationWeather(
  components: BattleWeatherComponents | undefined,
): SeparationWeather {
  if (components === undefined) return { night: false, visibilityUm: undefined };
  const visibility = computeEffectiveVisibility({
    baseVisibilityUm: components.baseVisibilityUm,
    precipitationMultiplierBp: computePrecipitationVisibilityMultiplierBp(
      components.precipitationType,
      components.precipitationIntensityBp,
    ),
    fogMultiplierBp: computeFogVisibilityMultiplierBp(components.fogMistDensityBp),
    daylightMultiplierBp: daylightVisibilityMultiplierBp(components.timeOfDay),
    glareMultiplierBp: GLARE_NEUTRAL_MULTIPLIER_BP,
    smokeMultiplierBp: NAVIGATION_BASIS_POINTS,
  });
  return {
    night: components.timeOfDay === "NIGHT" || components.timeOfDay === "TWILIGHT_NIGHT",
    visibilityUm: visibility.effectiveVisibilityUm,
  };
}

export function separationChanceBp(
  rules: NavigationSeparationRules,
  formation: SeparableFormation,
  weather: SeparationWeather,
  formationCohesionBp: number,
): number {
  const scale = NAVIGATION_BASIS_POINTS;
  const night = weather.night ? rules.nightFactorBp : scale;
  const poor =
    weather.visibilityUm !== undefined && weather.visibilityUm < rules.poorVisibilityThresholdUm
      ? rules.poorVisibilityFactorBp
      : scale;
  const afterNight = Math.floor((rules.formationBaseBp[formation] * night) / scale);
  const afterVisibility = Math.floor((afterNight * poor) / scale);
  const chance = Math.floor(
    (afterVisibility * rules.cohesionReferenceBp) / Math.max(1, formationCohesionBp),
  );
  return Math.min(scale, chance);
}
