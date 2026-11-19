import { BluewaveError } from "@bluewave/contracts";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import type { KnownMinefield, KnownMinefieldView } from "./minefields.js";

export const TACTICAL_MINEFIELD_RECORD_INVALID = "TACTICAL_MINEFIELD_RECORD_INVALID" as const;

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());

const TacticalMinefieldRecordSchema = Schema.Struct({
  id: nonEmptyString,
  xM: integer,
  yM: integer,
  radiusM: integer.check(Schema.isGreaterThanOrEqualTo(1)),
  knownToSideIds: Schema.Array(nonEmptyString),
  pressureBp: Schema.optional(integer.check(Schema.isGreaterThanOrEqualTo(0))),
});

export interface TacticalMinefieldRecord {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly radiusM: number;
  readonly knownToSideIds: readonly string[];
  readonly pressureBp?: number | undefined;
}

export type KnownMinefieldsBySide = Readonly<Record<string, KnownMinefieldView>>;

export function decodeTacticalMinefieldRecords(value: unknown): readonly TacticalMinefieldRecord[] {
  const records = decodeContract(
    Schema.Array(TacticalMinefieldRecordSchema),
    TACTICAL_MINEFIELD_RECORD_INVALID,
    value,
  );
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      throw new BluewaveError(TACTICAL_MINEFIELD_RECORD_INVALID, {
        code: TACTICAL_MINEFIELD_RECORD_INVALID,
        field: "id",
        reason: "tactical minefield ids must be unique",
        value: record.id,
      });
    }
    seen.add(record.id);
  }
  return records;
}

function byId(a: KnownMinefield, b: KnownMinefield): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function projectKnownMinefields(
  records: readonly TacticalMinefieldRecord[],
  sideIds: readonly string[],
): KnownMinefieldsBySide {
  const bySide: Record<string, KnownMinefieldView> = {};
  for (const sideId of sideIds) {
    const known: KnownMinefield[] = records
      .filter((record) => record.knownToSideIds.includes(sideId))
      .map(({ id, xM, yM, radiusM }) => ({ id, xM, yM, radiusM }))
      .sort(byId);
    if (known.length > 0) bySide[sideId] = { minefields: known };
  }
  return bySide;
}

export function minefieldsOfSide(
  bySide: KnownMinefieldsBySide | undefined,
  sideId: string,
): { minefields?: KnownMinefieldView } {
  if (bySide === undefined || !Object.hasOwn(bySide, sideId)) return {};
  const view = bySide[sideId];
  return view === undefined ? {} : { minefields: view };
}
