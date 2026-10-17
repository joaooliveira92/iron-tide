import { canonicalSerialize, hashWithContext } from "@bluewave/deterministic";
import { Schema } from "effect";
import type { EntityReference, Interpolation, TurnPhase } from "./schema.js";
import { InterpolationSchema, EntityReferenceSchema, TurnPhaseSchema } from "./schema.js";

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const INTERRUPTION_KINDS = ["decision", "battle"] as const;
export type InterruptionKind = (typeof INTERRUPTION_KINDS)[number];

export const EFFECT_DIRECTIONS = ["increase", "decrease", "none"] as const;
export type EffectDirection = (typeof EFFECT_DIRECTIONS)[number];

export const EFFECT_MAGNITUDES = ["minor", "moderate", "major"] as const;
export type EffectMagnitude = (typeof EFFECT_MAGNITUDES)[number];

/** A qualitative, non-revealing consequence hint for one decision option. */
export const EffectHintSchema = Schema.Struct({
  target: EntityReferenceSchema,
  attribute: nonEmptyString,
  direction: Schema.Literals(EFFECT_DIRECTIONS),
  magnitude: Schema.Literals(EFFECT_MAGNITUDES),
});
export interface EffectHint {
  readonly target: EntityReference;
  readonly attribute: string;
  readonly direction: EffectDirection;
  readonly magnitude: EffectMagnitude;
}

/** A declared, deterministic effect one option applies to authoritative state. */
export const DecisionEffectSchema = Schema.Struct({
  nationId: nonEmptyString,
  attribute: Schema.Literal("treasury"),
  delta: Schema.Number,
});
export interface DecisionEffect {
  readonly nationId: string;
  readonly attribute: "treasury";
  readonly delta: number;
}

export const DecisionOptionSchema = Schema.Struct({
  optionId: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  hints: Schema.Array(EffectHintSchema),
  effects: Schema.Array(DecisionEffectSchema),
});
export interface DecisionOption {
  readonly optionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly hints: readonly EffectHint[];
  readonly effects: readonly DecisionEffect[];
}

/** An authored decision offer (S-4 supplies the content; this is the port). */
export interface PendingDecision {
  readonly phase: TurnPhase;
  readonly subjectKey: string;
  readonly decisionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Interpolation;
  readonly options: readonly DecisionOption[];
}

export interface DecisionRequest {
  readonly kind: "decision";
  readonly turnId: string;
  readonly interruptionId: string;
  readonly phase: TurnPhase;
  readonly ordinal: number;
  readonly subjectKey: string;
  readonly decisionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Interpolation;
  readonly options: readonly DecisionOption[];
}

export interface DecisionAnswer {
  readonly interruptionId: string;
  readonly decisionId: string;
  readonly optionId: string;
}

export interface BattleRequest {
  readonly kind: "battle";
  readonly turnId: string;
  readonly interruptionId: string;
  readonly phase: TurnPhase;
  readonly ordinal: number;
  readonly subjectKey: string;
  readonly battleId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Interpolation;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly areaId: string;
}

/** A player-supplied battle outcome. Null winner/loser represents a tie. */
export interface BattleResultInput {
  readonly interruptionId: string;
  readonly battleId: string;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

export type InterruptionRequest = DecisionRequest | BattleRequest;
export type InterruptionPayload = DecisionAnswer | BattleResultInput;

/** A recorded external input, consumed strictly by ordinal on re-execution. */
export interface RecordedInput {
  readonly ordinal: number;
  readonly kind: InterruptionKind;
  readonly interruptionId: string;
  readonly payload: InterruptionPayload;
  readonly inputHash: string;
}

/** The pause point returned by a suspended turn. */
export interface SuspendedTurn {
  readonly turnId: string;
  readonly request: InterruptionRequest | null;
  readonly nextInterruptionOrdinal: number;
  readonly reason: SuspensionReason;
}

export const SUSPENSION_REASONS = ["awaiting-input", "invalid-input"] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

/** Deterministic turn identity: a function of the pre-turn state and inputs. */
export function computeTurnId(parts: {
  readonly campaignId: string;
  readonly startingRevision: number;
  readonly committedOrderHash: string;
  readonly orderedInputsHash: string;
}): string {
  return hashWithContext(canonicalSerialize(parts), "bluewave/turn-id");
}

/** Deterministic hash over the recorded inputs in canonical ordinal order. */
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

/** Deterministic interruption identity: a function of the turn, phase, ordinal and subject. */
export function computeInterruptionId(parts: {
  readonly turnId: string;
  readonly phase: TurnPhase;
  readonly ordinal: number;
  readonly subjectKey: string;
}): string {
  return hashWithContext(canonicalSerialize(parts), "bluewave/interruption-id");
}

/** Deterministic hash of one recorded input's identity and payload. */
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

/** Build a fully-identified recorded input, hashing its payload in place. */
export function makeRecordedInput(input: {
  readonly ordinal: number;
  readonly kind: InterruptionKind;
  readonly interruptionId: string;
  readonly payload: InterruptionPayload;
}): RecordedInput {
  return { ...input, inputHash: computeInputHash(input) };
}

const DecisionOptionWireSchema = Schema.Struct({
  optionId: nonEmptyString,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  hints: Schema.Array(EffectHintSchema),
  effects: Schema.Array(DecisionEffectSchema),
});

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
  options: Schema.Array(DecisionOptionWireSchema),
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

export const DecisionRequestWireSchema = DecisionRequestSchema;
export const BattleRequestWireSchema = BattleRequestSchema;

export const InterruptionRequestSchema = Schema.Union([DecisionRequestSchema, BattleRequestSchema]);

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

export const RecordedInputSchema = Schema.Struct({
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  kind: Schema.Literals(INTERRUPTION_KINDS),
  interruptionId: nonEmptyString,
  payload: Schema.Union([DecisionAnswerSchema, BattleResultInputSchema]),
  inputHash: nonEmptyString,
});

export const SuspendedTurnSchema = Schema.Struct({
  turnId: nonEmptyString,
  request: Schema.NullOr(InterruptionRequestSchema),
  nextInterruptionOrdinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  reason: Schema.Literals(SUSPENSION_REASONS),
});

function decode<T>(schema: Schema.ConstraintDecoder<T, never>) {
  return (input: unknown): T =>
    Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(input) as T;
}

export const decodeInterruptionRequest = decode<InterruptionRequest>(InterruptionRequestSchema);
export const decodeDecisionAnswer = decode<DecisionAnswer>(DecisionAnswerSchema);
export const decodeBattleResultInput = decode<BattleResultInput>(BattleResultInputSchema);
export const decodeRecordedInput = decode<RecordedInput>(RecordedInputSchema);
export const decodeSuspendedTurn = decode<SuspendedTurn>(SuspendedTurnSchema);
export const decodeRecordedInputs = decode<readonly RecordedInput[]>(
  Schema.Array(RecordedInputSchema),
);

/** Decode an input payload for a known kind, rejecting excess keys. */
export function decodeInterruptionPayload(
  kind: InterruptionKind,
  input: unknown,
): InterruptionPayload {
  return kind === "decision" ? decodeDecisionAnswer(input) : decodeBattleResultInput(input);
}

export type { Interpolation };
