import { BluewaveError } from "@bluewave/contracts";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import { floorMetres } from "../terrain/geometry.js";
import type { Position } from "../terrain/model.js";

export const KNOWN_MINEFIELD_VIEW_INVALID = "KNOWN_MINEFIELD_VIEW_INVALID" as const;

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());
const positiveInteger = integer.check(Schema.isGreaterThanOrEqualTo(1));

const KnownMinefieldSchema = Schema.Struct({
  id: nonEmptyString,
  xM: integer,
  yM: integer,
  radiusM: positiveInteger,
});

export const KnownMinefieldViewSchema = Schema.Struct({
  minefields: Schema.Array(KnownMinefieldSchema),
});

export interface KnownMinefield {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly radiusM: number;
}

export interface KnownMinefieldView {
  readonly minefields: readonly KnownMinefield[];
}

export function decodeKnownMinefieldView(value: unknown): KnownMinefieldView {
  const view = decodeContract(KnownMinefieldViewSchema, KNOWN_MINEFIELD_VIEW_INVALID, value);
  const seen = new Set<string>();
  for (const field of view.minefields) {
    if (seen.has(field.id)) {
      throw new BluewaveError(KNOWN_MINEFIELD_VIEW_INVALID, {
        code: KNOWN_MINEFIELD_VIEW_INVALID,
        field: "minefields.id",
        reason: "minefield ids must be unique",
        value: field.id,
      });
    }
    seen.add(field.id);
  }
  return view;
}

function reachesField(
  field: KnownMinefield,
  px: bigint,
  py: bigint,
  dx: bigint,
  dy: bigint,
): boolean {
  const cx = BigInt(field.xM) - px;
  const cy = BigInt(field.yM) - py;
  const radiusSquared = BigInt(field.radiusM) * BigInt(field.radiusM);
  const lengthSquared = dx * dx + dy * dy;
  const dot = cx * dx + cy * dy;
  if (lengthSquared === 0n || dot <= 0n) return cx * cx + cy * cy <= radiusSquared;
  if (dot >= lengthSquared) {
    const ex = cx - dx;
    const ey = cy - dy;
    return ex * ex + ey * ey <= radiusSquared;
  }
  const cross = cx * dy - cy * dx;
  return cross * cross <= radiusSquared * lengthSquared;
}

export function segmentCrossesMinefield(
  view: KnownMinefieldView,
  from: Position,
  to: Position,
): boolean {
  if (view.minefields.length === 0) return false;
  const px = BigInt(floorMetres(from[0]));
  const py = BigInt(floorMetres(from[1]));
  const dx = BigInt(floorMetres(to[0])) - px;
  const dy = BigInt(floorMetres(to[1])) - py;
  return view.minefields.some((field) => reachesField(field, px, py, dx, dy));
}
