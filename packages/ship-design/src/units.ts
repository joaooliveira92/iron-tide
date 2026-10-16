import { UnitError, type Brand } from "@bluewave/contracts";

// Canonical units are declared **once** in `@bluewave/contracts` (ADR-0202, map
// D2) and re-exported here so existing ship-design importers keep working (the
// migrate+contract steps keep a single definition). Authoring (millimetres) and
// sub-unit money (micro) brands are not canonical and stay local.
export {
  BP_ONE,
  KNOTS_TO_UMS,
  MM_TO_UM,
  UM_PER_INCH,
  UM_PER_KNOT,
  UnitError,
  bp,
  ceilDiv,
  kg,
  knotsToUmPerSec,
  kw,
  litre,
  mmToUm,
  mulBp,
  toSafe,
  um,
  umPerSec,
  type Bp,
  type Kg,
  type Kw,
  type Litre,
  type Um,
  type UmPerSec,
} from "@bluewave/contracts";

/** Authoring unit: millimetres (length/calibre/armour are canonical in µm). */
export type Mm = Brand<number, "Mm">;
/** Sub-unit money for the cost model; reaches campaign state only through the treasury bridge (map D3). */
export type BudgetMicro = Brand<number, "BudgetMicro">;
export type WorkMicro = Brand<number, "WorkMicro">;

function checked<T extends number>(unit: string, value: number, min: number): T {
  if (!Number.isSafeInteger(value)) throw new UnitError(unit, value, "must be a safe integer");
  if (value < min) throw new UnitError(unit, value, `must be >= ${min}`);
  return value as T;
}

export const mm = (v: number): Mm => checked<Mm>("Mm", v, 0);
export const budgetMicro = (v: number): BudgetMicro => checked<BudgetMicro>("BudgetMicro", v, 0);
export const workMicro = (v: number): WorkMicro => checked<WorkMicro>("WorkMicro", v, 0);
