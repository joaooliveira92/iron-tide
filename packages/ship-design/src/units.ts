import { UnitError, type Brand } from "@bluewave/contracts";

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
  money,
  mulBp,
  toSafe,
  um,
  umPerSec,
  type Bp,
  type Kg,
  type Kw,
  type Litre,
  type Money,
  type Um,
  type UmPerSec,
} from "@bluewave/contracts";

export type Mm = Brand<number, "Mm">;
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
