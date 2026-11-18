import type { DivisionFormation, DivisionRole } from "@bluewave/campaign";
import { DIVISION_FORMATIONS, DIVISION_ROLES } from "@bluewave/campaign";
import { BluewaveError } from "@bluewave/contracts";
import { Schema } from "effect";
import { DIVISION_ORDER_CONTROLS, WAYPOINT_MAX_METRES } from "../orders/constants.js";
import type { DivisionOrderControl } from "../orders/contracts.js";
import { decodeContract } from "../schema-issues.js";
import { CANONICAL_SHIP_TYPES, type CanonicalShipType } from "../tactical/shipType.js";
import { DIVISION_AI_VIEW_INVALID } from "./reasonCodes.js";

export const DIVISION_AI_VIEW_VERSION = "division_ai_view_v1" as const;
export const DIVISION_AI_TRACK_MAX_POINTS = 256 as const;
export const DIVISION_AI_CONTACT_KINDS = ["CAPITAL", "DESTROYER", "OTHER"] as const;

export type DivisionAiContactKind = (typeof DIVISION_AI_CONTACT_KINDS)[number];

export interface Point {
  readonly xMetres: number;
  readonly yMetres: number;
}

export interface DivisionAiDivision {
  readonly divisionId: string;
  readonly role: DivisionRole;
  readonly formation: DivisionFormation;
  readonly control: DivisionOrderControl;
  readonly shipTypes: readonly CanonicalShipType[];
  readonly position: Point;
  readonly headingDeg: number;
  readonly speedKnots: number;
  readonly maxSpeedKnots: number;
  readonly signalingBp: number;
  readonly searchCapable: boolean;
  readonly salvosLeft: number;
  readonly track: readonly Point[];
}

export interface DivisionAiContact {
  readonly contactId: string;
  readonly kind: DivisionAiContactKind;
  readonly position: Point;
  readonly headingDeg: number;
  readonly speedKnots: number;
}

export interface DivisionAiView {
  readonly version: typeof DIVISION_AI_VIEW_VERSION;
  readonly minute: number;
  readonly leadDivisionId: string;
  readonly divisions: readonly DivisionAiDivision[];
  readonly contacts: readonly DivisionAiContact[];
  readonly moraleBp: number;
  readonly flotillaAttackIssuedAtMinute: number | null;
  readonly objective: Point | null;
}

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());
const nonNegativeInteger = integer.check(Schema.isGreaterThanOrEqualTo(0));
const positiveInteger = integer.check(Schema.isGreaterThan(0));
const heading = integer.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(359));
const bp = integer.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(10_000));
const coordinate = integer.check(
  Schema.isGreaterThanOrEqualTo(-WAYPOINT_MAX_METRES),
  Schema.isLessThanOrEqualTo(WAYPOINT_MAX_METRES),
);

export const PointSchema = Schema.Struct({ xMetres: coordinate, yMetres: coordinate });

const divisionSchema = Schema.Struct({
  divisionId: nonEmptyString,
  role: Schema.Literals(DIVISION_ROLES),
  formation: Schema.Literals(DIVISION_FORMATIONS),
  control: Schema.Literals(DIVISION_ORDER_CONTROLS),
  shipTypes: Schema.Array(Schema.Literals(CANONICAL_SHIP_TYPES)).check(Schema.isMinLength(1)),
  position: PointSchema,
  headingDeg: heading,
  speedKnots: nonNegativeInteger,
  maxSpeedKnots: positiveInteger,
  signalingBp: bp.check(Schema.isGreaterThan(0)),
  searchCapable: Schema.Boolean,
  salvosLeft: nonNegativeInteger,
  track: Schema.Array(PointSchema).check(Schema.isMaxLength(DIVISION_AI_TRACK_MAX_POINTS)),
});

const contactSchema = Schema.Struct({
  contactId: nonEmptyString,
  kind: Schema.Literals(DIVISION_AI_CONTACT_KINDS),
  position: PointSchema,
  headingDeg: heading,
  speedKnots: nonNegativeInteger,
});

export const DivisionAiViewSchema = Schema.Struct({
  version: Schema.Literal(DIVISION_AI_VIEW_VERSION),
  minute: nonNegativeInteger,
  leadDivisionId: nonEmptyString,
  divisions: Schema.Array(divisionSchema),
  contacts: Schema.Array(contactSchema),
  moraleBp: bp,
  flotillaAttackIssuedAtMinute: Schema.NullOr(nonNegativeInteger),
  objective: Schema.NullOr(PointSchema),
});

export function decodeDivisionAiView(value: unknown): DivisionAiView {
  const view = decodeContract(DivisionAiViewSchema, DIVISION_AI_VIEW_INVALID, value);
  const ids = new Set(view.divisions.map((division) => division.divisionId));
  if (ids.size !== view.divisions.length || !ids.has(view.leadDivisionId)) {
    throw new BluewaveError(DIVISION_AI_VIEW_INVALID, {
      code: DIVISION_AI_VIEW_INVALID,
      field: "divisions",
      reason: "division ids must be unique and include the lead division",
    });
  }
  return view;
}
