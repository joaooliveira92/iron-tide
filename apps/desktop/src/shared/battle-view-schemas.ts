import type { BattleView } from "@bluewave/combat/battleResolution";
import { Result, Schema, SchemaIssue } from "effect";
import { ExplanationTreeSchema } from "./monthly-reports-schemas.js";
import { PLAYER_BATTLE_STANCES } from "./player-battle-orders.js";
import { int, nonEmptyString, nonNegativeInt } from "./schema-primitives.js";

const nullable = <S extends Schema.Top>(schema: S) => Schema.NullOr(schema);

const Point = Schema.Tuple([int, int]);

const contactBase = {
  handle: nonEmptyString,
  positionM: Point,
  ageMinutes: nonNegativeInt,
  courseDeg: int,
  speedMilliKnots: nonNegativeInt,
  confidenceBp: nonNegativeInt,
  stale: Schema.Boolean,
};

const ContactSchema = Schema.Union([
  Schema.Struct({ ...contactBase, tier: Schema.Literal("UNIDENTIFIED") }),
  Schema.Struct({ ...contactBase, tier: Schema.Literal("TYPE"), shipType: nonEmptyString }),
  Schema.Struct({
    ...contactBase,
    tier: Schema.Literal("CLASS"),
    shipType: nonEmptyString,
    className: nonEmptyString,
  }),
]);

const OrderSchema = Schema.Struct({
  stance: Schema.Literals(PLAYER_BATTLE_STANCES),
  speedPercent: nonNegativeInt,
  courseDeg: nullable(int),
  speedKnots: nullable(int),
  plannedCourse: nullable(
    Schema.Struct({
      kind: Schema.Literal("RAY"),
      fromM: Point,
      headingDeg: int,
      crossesLand: nullable(Schema.Boolean),
    }),
  ),
});

const OwnShipSchema = Schema.Struct({
  shipId: nonEmptyString,
  name: Schema.String,
  className: Schema.String,
  shipType: Schema.String,
  divisionId: nullable(nonEmptyString),
  positionM: nullable(Point),
  headingDeg: nullable(int),
  orderedSpeedMilliKnots: nullable(nonNegativeInt),
  currentSpeedMilliKnots: nullable(nonNegativeInt),
  attainableSpeedMilliKnots: nullable(nonNegativeInt),
  speedExplanation: nullable(ExplanationTreeSchema),
  damageStars: Schema.Literals([0, 1, 2, 3]),
  damageState: Schema.String,
  hitPoints: nonNegativeInt,
  maxHitPoints: nonNegativeInt,
  explanations: Schema.Struct({
    gunneryAccuracy: nullable(ExplanationTreeSchema),
    torpedoSolution: nullable(ExplanationTreeSchema),
    damageControl: nullable(ExplanationTreeSchema),
    loss: nullable(ExplanationTreeSchema),
  }),
  carriesMines: nullable(Schema.Boolean),
  machinery: nullable(Schema.Struct({ label: nonEmptyString })),
  separation: nullable(Schema.Literals(["SEPARATED", "DISORDERED"])),
  turrets: Schema.Array(
    Schema.Struct({
      turretId: nonEmptyString,
      bearingDeg: int,
      bearsOnTarget: Schema.Boolean,
    }),
  ),
});

const OwnDivisionSchema = Schema.Struct({
  divisionId: nonEmptyString,
  flag: Schema.Literal("PLAYER"),
  role: Schema.String,
  formation: Schema.String,
  leadShipId: nonEmptyString,
  control: Schema.Literal("PLAYER"),
  shipIds: Schema.Array(nonEmptyString),
  order: nullable(OrderSchema),
  offStation: nullable(Schema.Boolean),
});

const LogEntrySchema = Schema.Struct({
  minute: nonNegativeInt,
  severity: Schema.Literals(["INFO", "WARNING", "CRITICAL"]),
  eventType: nonEmptyString,
  actorRef: nullable(nonEmptyString),
  targetRef: nullable(nonEmptyString),
  actorPositionM: nullable(Point),
});

const WeatherSchema = Schema.Struct({
  seaState: Schema.String,
  precipitation: Schema.String,
  daylight: Schema.Boolean,
  visibilityM: nonNegativeInt,
  windDirectionDeg: int,
  windSpeedMetresPerSecond: nonNegativeInt,
});

const StatusSchema = Schema.Struct({
  minute: nonNegativeInt,
  elapsedMinutes: nonNegativeInt,
  maxMinutes: nonNegativeInt,
  dayPhase: Schema.Literals(["DAY", "NIGHT"]),
  localMinuteOfDay: nullable(nonNegativeInt),
  latLonAnchor: nullable(Schema.Struct({ latMicroDeg: int, lonMicroDeg: int })),
  weather: WeatherSchema,
});

const emptySeam = Schema.Array(Schema.Never);

const OverlaysSchema = Schema.Struct({
  sightingRangesM: Schema.Struct({ visualM: nonNegativeInt, radarM: nullable(nonNegativeInt) }),
  gunRangeArcs: emptySeam,
  fireLines: emptySeam,
  smoke: emptySeam,
  flotillaAttack: nullable(Schema.Boolean),
  forceState: nullable(Schema.String),
  terrain: Schema.Struct({ land: emptySeam, shallows: emptySeam, exclusionZones: emptySeam }),
});

const AccessibilitySchema = Schema.Struct({
  tierLabels: Schema.Struct({
    UNIDENTIFIED: nonEmptyString,
    TYPE: nonEmptyString,
    CLASS: nonEmptyString,
  }),
  stars: Schema.Record(Schema.String, nonEmptyString),
});

export const BATTLE_VIEW_PAUSE_REASONS = [
  "BATTLE_END",
  "SHIP_SUNK",
  "FRIENDLY_HIT",
  "TORPEDO",
  "ENEMY_SIGHTED",
  "CONTACT_LOST",
  "RUN_CAP",
] as const;

export const BattleViewSchema: Schema.Codec<BattleView> = Schema.Struct({
  version: Schema.Literal("battle_view_v1"),
  battleId: nonEmptyString,
  areaId: nonEmptyString,
  campaignMonth: nonEmptyString,
  side: Schema.Literals(["ATTACKER", "DEFENDER"]),
  playerNationId: nonEmptyString,
  ended: Schema.Boolean,
  endReason: nullable(Schema.String),
  winnerId: nullable(Schema.String),
  loserId: nullable(Schema.String),
  pauseReason: nullable(Schema.Literals(BATTLE_VIEW_PAUSE_REASONS)),
  objectives: Schema.Array(Schema.String),
  status: StatusSchema,
  divisions: Schema.Array(OwnDivisionSchema),
  ships: Schema.Array(OwnShipSchema),
  contacts: Schema.Array(ContactSchema),
  friendlyReports: Schema.Array(
    Schema.Struct({
      reportId: nonEmptyString,
      minute: nonNegativeInt,
      positionM: Point,
      strengthBand: nonEmptyString,
    }),
  ),
  overlays: OverlaysSchema,
  log: Schema.Array(LogEntrySchema),
  accessibility: AccessibilitySchema,
});

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

export type BattleViewDecoding =
  | { readonly kind: "decoded"; readonly view: BattleView }
  | { readonly kind: "invalid"; readonly issues: readonly string[] };

export function decodeBattleView(candidate: unknown): BattleViewDecoding {
  const decoded = Schema.decodeUnknownResult(BattleViewSchema, { onExcessProperty: "error" })(
    candidate,
  );
  if (Result.isFailure(decoded)) {
    return {
      kind: "invalid",
      issues: formatIssues(decoded.failure.issue).issues.map((issue) => issue.message),
    };
  }
  return { kind: "decoded", view: decoded.success };
}
