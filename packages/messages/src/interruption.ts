import { canonicalSerialize, hashWithContext } from "@bluewave/deterministic";
import { Schema } from "effect";
import type { Interpolation, TurnPhase } from "./schema.js";
import { InterpolationSchema, EntityReferenceSchema, TurnPhaseSchema } from "./schema.js";

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const INTERRUPTION_KINDS = ["decision", "battle", "offer"] as const;
export type InterruptionKind = (typeof INTERRUPTION_KINDS)[number];

export const EFFECT_DIRECTIONS = ["increase", "decrease", "none"] as const;
export type EffectDirection = (typeof EFFECT_DIRECTIONS)[number];

export const EFFECT_MAGNITUDES = ["minor", "moderate", "major"] as const;
export type EffectMagnitude = (typeof EFFECT_MAGNITUDES)[number];

export const EffectHintSchema = Schema.Struct({
  target: EntityReferenceSchema,
  attribute: nonEmptyString,
  direction: Schema.Literals(EFFECT_DIRECTIONS),
  magnitude: Schema.Literals(EFFECT_MAGNITUDES),
});
export type EffectHint = typeof EffectHintSchema.Type;

export const DecisionEffectSchema = Schema.Struct({
  nationId: nonEmptyString,
  attribute: Schema.Literal("treasury"),
  delta: Schema.Number,
});
export type DecisionEffect = typeof DecisionEffectSchema.Type;

export const DecisionOptionSchema = Schema.Struct({
  optionId: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  hints: Schema.Array(EffectHintSchema),
  effects: Schema.Array(DecisionEffectSchema),
});
export type DecisionOption = typeof DecisionOptionSchema.Type;

export interface PendingDecision {
  readonly phase: TurnPhase;
  readonly subjectKey: string;
  readonly decisionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Interpolation;
  readonly options: readonly DecisionOption[];
}

export type DecisionRequest = typeof DecisionRequestSchema.Type;

export type DecisionAnswer = typeof DecisionAnswerSchema.Type;

export type BattleRequest = typeof BattleRequestSchema.Type;

export const OFFER_ESTIMATE_MODELS = ["EXACT", "BANDED", "PERTURBED"] as const;
export type OfferEstimateModel = (typeof OFFER_ESTIMATE_MODELS)[number];

export const OFFER_SIDES = ["ATTACKER", "DEFENDER"] as const;
export type OfferSide = (typeof OFFER_SIDES)[number];

const OfferForceShipSchema = Schema.Struct({
  shipId: nonEmptyString,
  name: nonEmptyString,
  classId: nonEmptyString,
});

export type OfferForceShip = typeof OfferForceShipSchema.Type;

const OfferEstimateSchema = Schema.Struct({
  model: Schema.Literals(OFFER_ESTIMATE_MODELS),
  strength: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

export type OfferEstimate = typeof OfferEstimateSchema.Type;

export const offerContentFields = {
  battleId: nonEmptyString,
  missionType: nonEmptyString,
  acceptanceClass: nonEmptyString,
  areaId: nonEmptyString,
  attackerId: nonEmptyString,
  defenderId: nonEmptyString,
  playerSide: Schema.Literals(OFFER_SIDES),
  playerForce: Schema.Array(OfferForceShipSchema),
  estimate: OfferEstimateSchema,
  supportForcePresent: Schema.Boolean,
  supportNationIds: Schema.optional(Schema.Array(nonEmptyString)),
  declineStatementKeys: Schema.Array(nonEmptyString),
} as const;

export const OfferContentSchema = Schema.Struct(offerContentFields);

export type OfferContent = typeof OfferContentSchema.Type;

export type BattleResultInput = typeof BattleResultInputSchema.Type;

export const OFFER_RESPONSES = ["accept", "decline", "delegate"] as const;
export type OfferResponse = (typeof OFFER_RESPONSES)[number];

export type OfferResponseInput = typeof OfferResponseInputSchema.Type;

export type InterruptionRequest = DecisionRequest | BattleRequest | OfferRequest;
export type InterruptionPayload = DecisionAnswer | BattleResultInput | OfferResponseInput;

export type RecordedInput = typeof RecordedInputSchema.Type;

export type SuspendedTurn = typeof SuspendedTurnSchema.Type;

export const SUSPENSION_REASONS = ["awaiting-input", "invalid-input"] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

export function computeTurnId(parts: {
  readonly campaignId: string;
  readonly startingRevision: number;
  readonly committedOrderHash: string;
  readonly orderedInputsHash: string;
}): string {
  return hashWithContext(canonicalSerialize(parts), "bluewave/turn-id");
}

export function computeOrderedInputsHash(inputs: readonly RecordedInput[]): string {
  const projected = [...inputs]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((input) => ({
      ordinal: input.ordinal,
      kind: input.kind,
      interruptionId: input.interruptionId,
      inputHash: input.inputHash,
    }));
  return hashWithContext(canonicalSerialize(projected), "bluewave/turn-inputs");
}

export function computeInterruptionId(parts: {
  readonly turnId: string;
  readonly phase: TurnPhase;
  readonly ordinal: number;
  readonly subjectKey: string;
}): string {
  return hashWithContext(canonicalSerialize(parts), "bluewave/interruption-id");
}

export function computeInputHash(input: {
  readonly ordinal: number;
  readonly kind: InterruptionKind;
  readonly interruptionId: string;
  readonly payload: InterruptionPayload;
}): string {
  return hashWithContext(
    canonicalSerialize({
      ordinal: input.ordinal,
      kind: input.kind,
      interruptionId: input.interruptionId,
      payload: input.payload,
    }),
    "bluewave/turn-input",
  );
}

export function makeRecordedInput(input: {
  readonly ordinal: number;
  readonly kind: InterruptionKind;
  readonly interruptionId: string;
  readonly payload: InterruptionPayload;
}): RecordedInput {
  return { ...input, inputHash: computeInputHash(input) };
}

const DecisionRequestSchema = Schema.Struct({
  kind: Schema.Literal("decision"),
  turnId: nonEmptyString,
  interruptionId: nonEmptyString,
  phase: TurnPhaseSchema,
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  subjectKey: nonEmptyString,
  decisionId: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  interpolation: InterpolationSchema,
  options: Schema.Array(DecisionOptionSchema),
});

const BattleRequestSchema = Schema.Struct({
  kind: Schema.Literal("battle"),
  turnId: nonEmptyString,
  interruptionId: nonEmptyString,
  phase: TurnPhaseSchema,
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  subjectKey: nonEmptyString,
  battleId: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  interpolation: InterpolationSchema,
  attackerId: nonEmptyString,
  defenderId: nonEmptyString,
  areaId: nonEmptyString,
});

const OfferRequestSchema = Schema.Struct({
  kind: Schema.Literal("offer"),
  turnId: nonEmptyString,
  interruptionId: nonEmptyString,
  phase: TurnPhaseSchema,
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  subjectKey: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  interpolation: InterpolationSchema,
  ...offerContentFields,
});

export type OfferRequest = typeof OfferRequestSchema.Type;

export const DecisionRequestWireSchema = DecisionRequestSchema;
export const BattleRequestWireSchema = BattleRequestSchema;
export const OfferRequestWireSchema = OfferRequestSchema;

export const InterruptionRequestSchema = Schema.Union([
  DecisionRequestSchema,
  BattleRequestSchema,
  OfferRequestSchema,
]);

export const DecisionAnswerSchema = Schema.Struct({
  interruptionId: nonEmptyString,
  decisionId: nonEmptyString,
  optionId: nonEmptyString,
});

export const BattleResultInputSchema = Schema.Struct({
  interruptionId: nonEmptyString,
  battleId: nonEmptyString,
  winnerId: Schema.NullOr(nonEmptyString),
  loserId: Schema.NullOr(nonEmptyString),
  attackerLosses: Schema.Array(nonEmptyString),
  defenderLosses: Schema.Array(nonEmptyString),
  damageReport: Schema.Record(Schema.String, Schema.Number),
});

export const OfferResponseInputSchema = Schema.Struct({
  interruptionId: nonEmptyString,
  battleId: nonEmptyString,
  response: Schema.Literals(OFFER_RESPONSES),
});

export const RecordedInputSchema = Schema.Struct({
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  kind: Schema.Literals(INTERRUPTION_KINDS),
  interruptionId: nonEmptyString,
  payload: Schema.Union([DecisionAnswerSchema, BattleResultInputSchema, OfferResponseInputSchema]),
  inputHash: nonEmptyString,
});

export const SuspendedTurnSchema = Schema.Struct({
  turnId: nonEmptyString,
  request: Schema.NullOr(InterruptionRequestSchema),
  nextInterruptionOrdinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  reason: Schema.Literals(SUSPENSION_REASONS),
  refusalTag: Schema.optional(nonEmptyString),
});

function decode<S extends Schema.ConstraintDecoder<unknown>>(schema: S) {
  return (input: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(input);
}

export const decodeInterruptionRequest = decode(InterruptionRequestSchema);
export const decodeOfferRequest = decode(OfferRequestSchema);
export const decodeDecisionAnswer = decode(DecisionAnswerSchema);
export const decodeBattleResultInput = decode(BattleResultInputSchema);
export const decodeOfferResponseInput = decode(OfferResponseInputSchema);
export const decodeRecordedInput = decode(RecordedInputSchema);
export const decodeSuspendedTurn = decode(SuspendedTurnSchema);
export const decodeRecordedInputs = decode(Schema.Array(RecordedInputSchema));

export function decodeInterruptionPayload(
  kind: InterruptionKind,
  input: unknown,
): InterruptionPayload {
  if (kind === "decision") return decodeDecisionAnswer(input);
  if (kind === "offer") return decodeOfferResponseInput(input);
  return decodeBattleResultInput(input);
}

export type { Interpolation };
