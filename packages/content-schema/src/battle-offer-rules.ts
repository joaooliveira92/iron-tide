import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
/** Basis points in the closed range 0..10000. */
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);

/** Explicit rounding for every derived integer (ENGINEERING-CONTRACT: bounds and rounding are stated, never implied). */
export const BATTLE_OFFER_ROUNDING_MODES = ["FLOOR", "CEIL", "HALF_UP"] as const;
const RoundingSchema = Schema.Literals(BATTLE_OFFER_ROUNDING_MODES);

/** G1: how the battle-offer screen estimates the enemy force. Extensible tagged union; no variant has a default. */
export const BattleOfferEstimateModelSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("EXACT"), showComposition: Schema.Boolean }),
  Schema.Struct({
    kind: Schema.Literal("BANDED"),
    /** Band width in strength units. */
    bandWidthStrength: positiveInt,
    rounding: RoundingSchema,
    showComposition: Schema.Boolean,
  }),
  Schema.Struct({
    kind: Schema.Literal("PERTURBED"),
    /** Symmetric error bound as basis points of true strength. */
    errorBoundBp: basisPoints,
    rounding: RoundingSchema,
    showComposition: Schema.Boolean,
  }),
]);

/** G3: whether and how a decline credits the opponent's war score. */
export const BattleOfferOpponentCreditSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("NONE") }),
  Schema.Struct({ kind: Schema.Literal("MIRROR") }),
  Schema.Struct({ kind: Schema.Literal("FRACTION_BP"), fractionBp: basisPoints }),
]);

/** G2: the victory-point cost of declining, per mission type, applied through the war-score seam. */
export const BattleOfferDeclineVictoryPointsSchema = Schema.Struct({
  /** War-score points per mission type; keys are battle mission type ids (validated against the combat vocabulary by the consumer). */
  pointsByMission: Schema.Record(Schema.NonEmptyString, nonNegativeInt),
  /** Optional reduction by a distance measure; the measure id and unit are defined by the owner answer. */
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

/** G4: the counter behind "several declined battles". */
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

/** G6: the chance the enemy declines when it cannot field reasonable chances of victory. */
export const BattleOfferEnemyDeclineSchema = Schema.Struct({
  /** The predicate holds when the enemy-to-player strength ratio (basis points) satisfies `comparison` against `thresholdBp`. */
  comparison: Schema.Literals(["LESS_THAN", "LESS_OR_EQUAL"]),
  thresholdBp: nonNegativeInt,
  probabilityBp: basisPoints,
  /** Optional victory-point cost to the declining enemy; absent = none. */
  enemyCostPoints: Schema.optional(nonNegativeInt),
});

/** G7: the friendly AI support force that sometimes joins a battle. */
export const BattleOfferSupportForceSchema = Schema.Struct({
  presenceChanceBp: basisPoints,
  /** Share of the existing allied-strength cap, in basis points 0..5000. */
  shareOfCapBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 5_000 }),
  ),
  source: Schema.Literals(["ALLIED_ONLY", "ALLIED_AND_OWN_AI_DIVISIONS"]),
});

/** G5: the optional declined-battle prestige sub-rule, in the S-2 value-set shape. Absent = counter and event only. */
export const BattleOfferDeclinedPrestigeSchema = Schema.Struct({
  rule: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("PROPORTIONAL_LOSS"), basisPoints: basisPoints }),
    Schema.Struct({ kind: Schema.Literal("FIXED_LOSS"), amount: nonNegativeInt }),
  ]),
  repeat: Schema.Literals(["ONCE_AT_THRESHOLD", "EACH_FURTHER_DECLINE"]),
});

/**
 * The optional battle-offer ruleset section (spec #109 R1, ticket #111): every T-1 value in one versioned block with
 * provenance. Absent = dormant, an explicit state and never a numeric default. A present section is all-or-nothing
 * (except the declined-battle prestige sub-rule), so a half-authored one cannot silently switch the offer on.
 */
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

/** Strictly decode the battle-offer section from untrusted input: excess keys rejected, a failure names the first offending field. */
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
