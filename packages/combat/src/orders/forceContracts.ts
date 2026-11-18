import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import { FORCE_MORALE_MAX_BP, FORCE_ORDER_VERSION } from "./forceConstants.js";
import { FORCE_ORDER_INVALID } from "./reasonCodes.js";

export type ForceOrderKind =
  | "FLOTILLA_ATTACK"
  | "FLOTILLA_RECALL"
  | "RALLY"
  | "DISENGAGE"
  | "CHANGE_LEAD_DIVISION"
  | "BATTLE_TURN_AWAY";

export interface ForceOrderBase {
  readonly forceId: string;
  readonly issuedAtMinute: number;
}

export interface ForceKindOrder extends ForceOrderBase {
  readonly kind: Exclude<ForceOrderKind, "CHANGE_LEAD_DIVISION">;
}

export interface ChangeLeadDivisionOrder extends ForceOrderBase {
  readonly kind: "CHANGE_LEAD_DIVISION";
  readonly divisionId: string;
}

export type ForceOrder = ForceKindOrder | ChangeLeadDivisionOrder;

export interface ForceOrderSet {
  readonly version: typeof FORCE_ORDER_VERSION;
  readonly orders: readonly ForceOrder[];
}

export interface ForceState {
  readonly moraleBp: number;
  readonly flotillaAttackActive: boolean;
  readonly leadChangeUsed: boolean;
  readonly turnAwayUsed: boolean;
}

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());
const nonNegativeInteger = integer.check(Schema.isGreaterThanOrEqualTo(0));
const moraleBp = integer.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(FORCE_MORALE_MAX_BP),
);

const plainKinds = Schema.Literals([
  "FLOTILLA_ATTACK",
  "FLOTILLA_RECALL",
  "RALLY",
  "DISENGAGE",
  "BATTLE_TURN_AWAY",
]);

const plainOrderSchema = Schema.Struct({
  forceId: nonEmptyString,
  kind: plainKinds,
  issuedAtMinute: nonNegativeInteger,
});

const changeLeadOrderSchema = Schema.Struct({
  forceId: nonEmptyString,
  kind: Schema.Literal("CHANGE_LEAD_DIVISION"),
  divisionId: nonEmptyString,
  issuedAtMinute: nonNegativeInteger,
});

export const ForceOrderSchema = Schema.Union([plainOrderSchema, changeLeadOrderSchema]);

export const ForceOrderSetSchema = Schema.Struct({
  version: Schema.Literal(FORCE_ORDER_VERSION),
  orders: Schema.Array(ForceOrderSchema),
});

export const ForceStateSchema = Schema.Struct({
  moraleBp,
  flotillaAttackActive: Schema.Boolean,
  leadChangeUsed: Schema.Boolean,
  turnAwayUsed: Schema.Boolean,
});

export function decodeForceOrderSet(value: unknown): ForceOrderSet {
  return decodeContract(ForceOrderSetSchema, FORCE_ORDER_INVALID, value);
}

export function decodeForceState(value: unknown): ForceState {
  return decodeContract(ForceStateSchema, FORCE_ORDER_INVALID, value);
}
