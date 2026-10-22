import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);

export const BATTLE_OFFER_ROUNDING_MODES = ["FLOOR", "CEIL", "HALF_UP"] as const;
const RoundingSchema = Schema.Literals(BATTLE_OFFER_ROUNDING_MODES);

export const BattleOfferEstimateModelSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("EXACT"), showComposition: Schema.Boolean }),
  Schema.Struct({
    kind: Schema.Literal("BANDED"),
    bandWidthStrength: positiveInt,
    rounding: RoundingSchema,
    showComposition: Schema.Boolean,
  }),
  Schema.Struct({
    kind: Schema.Literal("PERTURBED"),
    errorBoundBp: basisPoints,
    rounding: RoundingSchema,
    showComposition: Schema.Boolean,
  }),
]);

export const BattleOfferOpponentCreditSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("NONE") }),
  Schema.Struct({ kind: Schema.Literal("MIRROR") }),
  Schema.Struct({ kind: Schema.Literal("FRACTION_BP"), fractionBp: basisPoints }),
]);

export const BattleOfferDeclineVictoryPointsSchema = Schema.Struct({
  pointsByMission: Schema.Record(Schema.NonEmptyString, nonNegativeInt),
  distanceModifier: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("NONE") }),
    Schema.Struct({
      kind: Schema.Literal("REDUCTION_BP"),
      measure: Schema.NonEmptyString,
      reductionBp: basisPoints,
    }),
  ]),
  rounding: RoundingSchema,
  opponentCredit: BattleOfferOpponentCreditSchema,
});

export const BattleOfferDeclineCounterSchema = Schema.Struct({
  threshold: positiveInt,
  scope: Schema.Literals(["WAR", "NATION", "CAMPAIGN"]),
  reset: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("NONE") }),
    Schema.Struct({ kind: Schema.Literal("ON_WAR_END") }),
    Schema.Struct({
      kind: Schema.Literal("DECAY"),
      countRemoved: positiveInt,
      perMonths: positiveInt,
    }),
  ]),
});

export const BattleOfferEnemyDeclineSchema = Schema.Struct({
  comparison: Schema.Literals(["LESS_THAN", "LESS_OR_EQUAL"]),
  thresholdBp: nonNegativeInt,
  probabilityBp: basisPoints,
  enemyCostPoints: Schema.optional(nonNegativeInt),
});

export const BattleOfferSupportForceSchema = Schema.Struct({
  presenceChanceBp: basisPoints,
  shareOfCapBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 5_000 }),
  ),
  source: Schema.Literals(["ALLIED_ONLY", "ALLIED_AND_OWN_AI_DIVISIONS"]),
});

export const BattleOfferDeclinedPrestigeSchema = Schema.Struct({
  rule: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("PROPORTIONAL_LOSS"), basisPoints: basisPoints }),
    Schema.Struct({ kind: Schema.Literal("FIXED_LOSS"), amount: nonNegativeInt }),
  ]),
  repeat: Schema.Literals(["ONCE_AT_THRESHOLD", "EACH_FURTHER_DECLINE"]),
});

export const BattleOfferRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  estimateModel: BattleOfferEstimateModelSchema,
  declineVictoryPoints: BattleOfferDeclineVictoryPointsSchema,
  declineCounter: BattleOfferDeclineCounterSchema,
  enemyDecline: BattleOfferEnemyDeclineSchema,
  supportForce: BattleOfferSupportForceSchema,
  declinedBattlePrestige: Schema.optional(BattleOfferDeclinedPrestigeSchema),
  provenance: ProvenanceSchema,
});

export type BattleOfferRules = typeof BattleOfferRulesSchema.Type;

export type BattleOfferRulesDecoded =
  | { readonly ok: true; readonly value: BattleOfferRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeBattleOfferRules(input: unknown): BattleOfferRulesDecoded {
  const result = Schema.decodeUnknownResult(BattleOfferRulesSchema, {
    ...CONTENT_DECODE_OPTIONS,
    errors: "all",
  })(input);
  if (Result.isSuccess(result)) return { ok: true, value: result.success };
  const [first] = formatter(result.failure.issue).issues;
  const path = (first?.path ?? []).filter(
    (key): key is string | number => typeof key === "string" || typeof key === "number",
  );
  return {
    ok: false,
    field: path.length > 0 ? path.join(".") : "(root)",
    message: first?.message ?? "is invalid",
  };
}
