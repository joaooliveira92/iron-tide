import { BluewaveError } from "@bluewave/contracts";
import {
  PER_BATTERY_MINE_PRESSURE_INCREMENT,
  COASTAL_DEFENSE_RULESET_VERSION,
} from "./constants.js";
import { COASTAL_ARTILLERY_MINE_PRESSURE_MISSING } from "./reasonCodes.js";

export const COASTAL_ARTILLERY_MINE_SOURCE_ID = "coastal_artillery" as const;

export interface CoastalArtilleryMinePressure {
  readonly areaId: string;
  readonly pressureIncrement: number;
  readonly batteryCount: number;
}

export function calculateCoastalArtilleryMinePressure(
  areaId: string,
  intactBatteryCount: number,
): CoastalArtilleryMinePressure {
  if (intactBatteryCount < 0) {
    throw new BluewaveError(COASTAL_ARTILLERY_MINE_PRESSURE_MISSING, {
      code: COASTAL_ARTILLERY_MINE_PRESSURE_MISSING,
      areaId,
      reason: `negative battery count: ${intactBatteryCount}`,
    });
  }
  return {
    areaId,
    pressureIncrement: intactBatteryCount * PER_BATTERY_MINE_PRESSURE_INCREMENT,
    batteryCount: intactBatteryCount,
  };
}

export function coastalArtilleryMinePressureHash(pressure: CoastalArtilleryMinePressure): string {
  const input = `${COASTAL_DEFENSE_RULESET_VERSION}|${pressure.areaId}|${pressure.pressureIncrement}|${pressure.batteryCount}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
