import { TURN_PHASES, type TurnPhase } from "@bluewave/contracts";
import { Schema } from "effect";

export { TURN_PHASES, type TurnPhase };

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

const campaignDatePattern = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Expected YYYY-MM" }),
);

const scalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);

export const MESSAGE_SEVERITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW", "TRACE"] as const;
export type MessageSeverity = (typeof MESSAGE_SEVERITIES)[number];
export const MessageSeveritySchema = Schema.Literals(MESSAGE_SEVERITIES);

export const MESSAGE_CATEGORIES = [
  "DECISION",
  "DIPLOMACY",
  "WAR",
  "BATTLE",
  "CONSTRUCTION",
  "RESEARCH",
  "INTELLIGENCE",
  "FINANCE",
  "SYSTEM",
] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];
export const MessageCategorySchema = Schema.Literals(MESSAGE_CATEGORIES);

export const TurnPhaseSchema = Schema.Literals(TURN_PHASES);

export const ENTITY_REFERENCE_TYPES = [
  "ship",
  "shipClass",
  "nation",
  "region",
  "technology",
  "constructionProject",
  "battle",
  "formation",
] as const;
export type EntityReferenceType = (typeof ENTITY_REFERENCE_TYPES)[number];

export type EntityReference = {
  readonly [T in EntityReferenceType]: { readonly type: T; readonly id: string };
}[EntityReferenceType];

function entityRef<T extends EntityReferenceType>(type: T) {
  return Schema.Struct({ type: Schema.Literal(type), id: nonEmptyString });
}

export const EntityReferenceSchema = Schema.Union([
  entityRef("ship"),
  entityRef("shipClass"),
  entityRef("nation"),
  entityRef("region"),
  entityRef("technology"),
  entityRef("constructionProject"),
  entityRef("battle"),
  entityRef("formation"),
]);

export const EFFECT_VISIBILITIES = ["exact", "qualitative", "hidden"] as const;
export type EffectVisibility = (typeof EFFECT_VISIBILITIES)[number];

export const EffectReferenceSchema = Schema.Struct({
  target: EntityReferenceSchema,
  attribute: nonEmptyString,
  previousValue: Schema.optional(scalar),
  newValue: Schema.optional(scalar),
  delta: Schema.optional(Schema.Number),
  visibility: Schema.Literals(EFFECT_VISIBILITIES),
});
export interface EffectReference {
  readonly target: EntityReference;
  readonly attribute: string;
  readonly previousValue?: string | number | boolean;
  readonly newValue?: string | number | boolean;
  readonly delta?: number;
  readonly visibility: EffectVisibility;
}

export const InterpolationSchema = Schema.Record(Schema.String, scalar);
export type Interpolation = Readonly<Record<string, string | number | boolean>>;

export const DebugMetadataSchema = Schema.Struct({
  sourceEventIds: Schema.Array(nonEmptyString),
  projectionVersion: nonEmptyString,
  rulesetVersion: nonEmptyString,
  contentVersion: nonEmptyString,
});
export interface DebugMetadata {
  readonly sourceEventIds: readonly string[];
  readonly projectionVersion: string;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
}

export const TurnMessageSchema = Schema.Struct({
  id: nonEmptyString,
  turnId: nonEmptyString,
  occurredAt: campaignDatePattern,
  phase: TurnPhaseSchema,
  category: MessageCategorySchema,
  severity: MessageSeveritySchema,
  titleKey: nonEmptyString,
  bodyKey: nonEmptyString,
  interpolation: InterpolationSchema,
  subjectRefs: Schema.Array(EntityReferenceSchema),
  effectRefs: Schema.Array(EffectReferenceSchema),
  blocking: Schema.Boolean,
  requiresAcknowledgement: Schema.Boolean,
  decisionId: Schema.optional(nonEmptyString),
  battleId: Schema.optional(nonEmptyString),
  deduplicationKey: Schema.optional(nonEmptyString),
  aggregateKey: Schema.optional(nonEmptyString),
  playerVisible: Schema.Boolean,
  debugMetadata: Schema.optional(DebugMetadataSchema),
});
export type TurnMessage = typeof TurnMessageSchema.Type;

export type CampaignDate = string;

const DECODE_OPTIONS = { onExcessProperty: "error" } as const;

export function decodeTurnMessage(input: unknown): TurnMessage {
  return Schema.decodeUnknownSync(TurnMessageSchema, DECODE_OPTIONS)(input);
}

export function decodeTurnMessages(input: unknown): readonly TurnMessage[] {
  return Schema.decodeUnknownSync(Schema.Array(TurnMessageSchema), DECODE_OPTIONS)(input);
}
