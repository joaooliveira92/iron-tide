import { createEnvelope } from "@bluewave/deterministic";
import {
  COASTAL_DEFENSE_RULESET_VERSION,
  coastalBatteryPolicyId,
  type LandTargetType,
  type LandTargetDamageState,
  type CoastalBatteryModel,
  type CoastalBatteryEraBand,
} from "./constants.js";
import { compareStrings } from "../core/ordering.js";

export interface CoastalDefenseBatteryRecord {
  readonly model: CoastalBatteryModel;
  readonly caliberMm: number;
  readonly eraBand: CoastalBatteryEraBand;
  readonly hasAA: boolean;
  readonly targetType: LandTargetType;
  readonly damageState: LandTargetDamageState;
  readonly effectivenessBp: number;
  readonly minePressureIncrement: number;
}

export interface CoastalDefensePositionRecord {
  readonly zoneId: string;
  readonly areaId: string;
  readonly positionIndex: number;
  readonly batteries: readonly CoastalDefenseBatteryRecord[];
}

export interface CoastalDefenseAreaRecord {
  readonly areaId: string;
  readonly positions: readonly CoastalDefensePositionRecord[];
  readonly totalMinePressureIncrement: number;
}

export interface CoastalDefenseOperationsRecord {
  readonly rulesetVersion: string;
  readonly areas: readonly CoastalDefenseAreaRecord[];
  readonly processedAt: string;
  readonly recordHash: string;
}

export function createCoastalDefenseOperationsRecord(
  areas: readonly CoastalDefenseAreaRecord[],
  processedAt: string,
): CoastalDefenseOperationsRecord {
  const sortedAreas = [...areas]
    .map((a) => ({
      ...a,
      positions: [...a.positions].sort(
        (x, y) => compareStrings(x.zoneId, y.zoneId) || x.positionIndex - y.positionIndex,
      ),
    }))
    .sort((a, b) => compareStrings(a.areaId, b.areaId));
  const surface = {
    rulesetVersion: COASTAL_DEFENSE_RULESET_VERSION,
    areas: sortedAreas,
    processedAt,
  };
  const envelope = createEnvelope(
    "coastal-defense-operations-record",
    coastalBatteryPolicyId,
    surface,
  );
  return {
    ...surface,
    recordHash: envelope.bodyHash,
  };
}
