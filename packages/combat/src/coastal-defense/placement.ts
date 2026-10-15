import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID } from "./reasonCodes.js";

export interface CoastalDefensePosition {
  readonly zoneId: string;
  readonly areaId: string;
  readonly positionIndex: SafeInt;
}

export interface CoastalDefenseZone {
  readonly zoneId: string;
  readonly areaId: string;
  readonly validBatteryModels: readonly string[];
  readonly maxBatteries: SafeInt;
}

export function validatePlacementZone(
  zone: CoastalDefenseZone,
  validZones: readonly CoastalDefenseZone[],
): void {
  const match = validZones.find((z) => z.zoneId === zone.zoneId && z.areaId === zone.areaId);
  if (!match) {
    throw new BluewaveError(COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID, {
      code: COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID,
      zoneId: zone.zoneId,
      areaId: zone.areaId,
    });
  }
}

export function selectCoastalDefensePositions(
  areaId: string,
  validZones: readonly CoastalDefenseZone[],
  seed: string,
): readonly CoastalDefensePosition[] {
  if (validZones.length === 0) return [];

  const zone = validZones[0]!;
  validatePlacementZone(zone, validZones);

  const seedHash = simpleHash(`${seed}/coastal_defense/placement/${areaId}/${zone.zoneId}`);
  const count = Math.min(
    zone.maxBatteries.valueOf(),
    1 + (seedHash % Math.max(1, zone.maxBatteries.valueOf())),
  );

  const positions: CoastalDefensePosition[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      zoneId: zone.zoneId,
      areaId,
      positionIndex: SafeInt(i),
    });
  }
  return positions;
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
