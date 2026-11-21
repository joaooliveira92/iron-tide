import { BluewaveError } from "@bluewave/contracts";
import {
  TACTICAL_MINEFIELD_RECORD_INVALID,
  decodeTacticalMinefieldRecords,
  type TacticalMinefieldRecord,
} from "./knownMinefields.js";

export interface LayTacticalMinefieldInput {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly radiusM: number;
  readonly layerSideId: string;
  readonly pressureBp?: number | undefined;
}

export function layTacticalMinefield(input: LayTacticalMinefieldInput): TacticalMinefieldRecord {
  const [record] = decodeTacticalMinefieldRecords([
    {
      id: input.id,
      xM: input.xM,
      yM: input.yM,
      radiusM: input.radiusM,
      knownToSideIds: [input.layerSideId],
      ...(input.pressureBp === undefined ? {} : { pressureBp: input.pressureBp }),
    },
  ]);
  if (record === undefined) {
    throw new BluewaveError(TACTICAL_MINEFIELD_RECORD_INVALID, {
      code: TACTICAL_MINEFIELD_RECORD_INVALID,
      field: "id",
      reason: "a laid minefield decodes to exactly one record",
      value: input.id,
    });
  }
  return record;
}

export function recordMinefieldSweep(
  records: readonly TacticalMinefieldRecord[],
  fieldId: string,
  sweeperSideId: string,
): readonly TacticalMinefieldRecord[] {
  if (sweeperSideId.length === 0 || !records.some((record) => record.id === fieldId)) {
    throw new BluewaveError(TACTICAL_MINEFIELD_RECORD_INVALID, {
      code: TACTICAL_MINEFIELD_RECORD_INVALID,
      field: sweeperSideId.length === 0 ? "sweeperSideId" : "id",
      reason:
        sweeperSideId.length === 0
          ? "a sweep needs a sweeper side"
          : "only a laid minefield can be swept",
      value: sweeperSideId.length === 0 ? sweeperSideId : fieldId,
    });
  }
  return records.map((record) =>
    record.id !== fieldId || record.knownToSideIds.includes(sweeperSideId)
      ? record
      : { ...record, knownToSideIds: [...record.knownToSideIds, sweeperSideId] },
  );
}
