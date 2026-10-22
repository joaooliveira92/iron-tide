import { BluewaveError } from "@bluewave/contracts";
import {
  FUNNEL_FUEL_MULTIPLIERS,
  FUNNEL_POWER_MULTIPLIERS,
  FUNNEL_SMOKE_BASE_DENSITY,
} from "./constants.js";
import { WEATHER_SMOKE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export function computeFunnelSmokeDensity(params: {
  fuelType: string;
  powerSettingBp: number;
  machineryConditionBp?: number;
}): number {
  const machCondBp = params.machineryConditionBp ?? 10_000;

  const fuelMultiplierBp = FUNNEL_FUEL_MULTIPLIERS[params.fuelType];
  if (fuelMultiplierBp === undefined) {
    throw new BluewaveError(WEATHER_SMOKE_STATE_INVARIANT_FAILED, {
      code: WEATHER_SMOKE_STATE_INVARIANT_FAILED,
      fuelType: params.fuelType,
      detail: `unknown fuel type: ${params.fuelType}`,
    });
  }

  let powerMultiplierBp = 0;
  for (const band of FUNNEL_POWER_MULTIPLIERS) {
    if (params.powerSettingBp >= band.minBp && params.powerSettingBp <= band.maxBp) {
      powerMultiplierBp = band.multiplier;
      break;
    }
  }

  const numerator = FUNNEL_SMOKE_BASE_DENSITY * fuelMultiplierBp * powerMultiplierBp * machCondBp;
  const denominator = 10_000 * 10_000 * 10_000;
  const raw = Math.floor(numerator / denominator);

  return Math.min(10_000, raw);
}
