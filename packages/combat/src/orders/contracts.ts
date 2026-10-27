import type { DivisionFormation, DivisionRole } from "@bluewave/campaign";
import { DIVISION_FORMATIONS, DIVISION_ROLES } from "@bluewave/campaign";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import {
  DIVISION_NAVIGATION_KINDS,
  DIVISION_ORDER_CONTROLS,
  DIVISION_ORDER_VERSION,
  DIVISION_SPEED_KINDS,
  DIVISION_SPEED_PRESETS,
  DIVISION_STANCES,
} from "./constants.js";
import { DIVISION_ORDER_INVALID } from "./reasonCodes.js";

export type DivisionOrderControl = (typeof DIVISION_ORDER_CONTROLS)[number];
export type DivisionNavigationKind = (typeof DIVISION_NAVIGATION_KINDS)[number];
export type DivisionSpeedKind = (typeof DIVISION_SPEED_KINDS)[number];
export type DivisionSpeedPreset = (typeof DIVISION_SPEED_PRESETS)[number];
export type DivisionStance = (typeof DIVISION_STANCES)[number];

export interface DivisionStanceNavigation {
  readonly kind: "STANCE";
  readonly stance: DivisionStance;
}

export interface DivisionCourseNavigation {
  readonly kind: "COURSE";
  readonly headingDeg: number;
}

export interface DivisionWaypointNavigation {
  readonly kind: "WAYPOINT";
  readonly xMetres: number;
  readonly yMetres: number;
  readonly pauseOnArrival: boolean;
}

export type DivisionNavigation =
  | DivisionStanceNavigation
  | DivisionCourseNavigation
  | DivisionWaypointNavigation;

export interface DivisionSpeedPercent {
  readonly kind: "PERCENT";
  readonly percent: number;
}

export interface DivisionSpeedKnots {
  readonly kind: "KNOTS";
  readonly knots: number;
}

export interface DivisionSpeedPresetValue {
  readonly kind: "PRESET";
  readonly preset: DivisionSpeedPreset;
}

export type DivisionSpeed = DivisionSpeedPercent | DivisionSpeedKnots | DivisionSpeedPresetValue;

export interface DivisionOrder {
  readonly divisionId: string;
  readonly navigation: DivisionNavigation;
  readonly speed: DivisionSpeed;
  readonly formation: DivisionFormation | null;
  readonly role: DivisionRole | null;
  readonly leadDivisionId: string | null;
  readonly control: DivisionOrderControl;
  readonly turnTogether: boolean;
  readonly issuedAtMinute: number;
}

export interface DivisionOrderSet {
  readonly version: typeof DIVISION_ORDER_VERSION;
  readonly divisions: readonly DivisionOrder[];
}

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());
const nonNegativeInteger = integer.check(Schema.isGreaterThanOrEqualTo(0));
const heading = integer.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(359));
const percent = integer.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100));
const positiveInteger = integer.check(Schema.isGreaterThan(0));

const stanceNavigationSchema = Schema.Struct({
  kind: Schema.Literal("STANCE"),
  stance: Schema.Literals(DIVISION_STANCES),
});

const courseNavigationSchema = Schema.Struct({
  kind: Schema.Literal("COURSE"),
  headingDeg: heading,
});

const waypointNavigationSchema = Schema.Struct({
  kind: Schema.Literal("WAYPOINT"),
  xMetres: integer,
  yMetres: integer,
  pauseOnArrival: Schema.Boolean,
});

const navigationSchema = Schema.Union([
  stanceNavigationSchema,
  courseNavigationSchema,
  waypointNavigationSchema,
]);

const percentSpeedSchema = Schema.Struct({
  kind: Schema.Literal("PERCENT"),
  percent,
});

const knotsSpeedSchema = Schema.Struct({
  kind: Schema.Literal("KNOTS"),
  knots: positiveInteger,
});

const presetSpeedSchema = Schema.Struct({
  kind: Schema.Literal("PRESET"),
  preset: Schema.Literals(DIVISION_SPEED_PRESETS),
});

const speedSchema = Schema.Union([percentSpeedSchema, knotsSpeedSchema, presetSpeedSchema]);

export const DivisionOrderSchema = Schema.Struct({
  divisionId: nonEmptyString,
  navigation: navigationSchema,
  speed: speedSchema,
  formation: Schema.NullOr(Schema.Literals(DIVISION_FORMATIONS)),
  role: Schema.NullOr(Schema.Literals(DIVISION_ROLES)),
  leadDivisionId: Schema.NullOr(nonEmptyString),
  control: Schema.Literals(DIVISION_ORDER_CONTROLS),
  turnTogether: Schema.Boolean,
  issuedAtMinute: nonNegativeInteger,
});

export const DivisionOrderSetSchema = Schema.Struct({
  version: Schema.Literal(DIVISION_ORDER_VERSION),
  divisions: Schema.Array(DivisionOrderSchema),
});

export function decodeDivisionOrderSet(value: unknown): DivisionOrderSet {
  return decodeContract(DivisionOrderSetSchema, DIVISION_ORDER_INVALID, value);
}
