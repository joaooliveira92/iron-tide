import { Schema } from "effect";
import type { DomainEventBody, DomainEventEnvelope } from "./envelope.js";

/**
 * Strictness policy for the event boundary: unmodeled (excess) keys are rejected,
 * preserving the previous Zod `.strict()` behavior exactly. Same policy as
 * ADR-0105's content-schema boundary (adopted here; events does not depend on
 * content-schema, so the option is declared locally).
 */
const parseOptions = { onExcessProperty: "error" } as const;

/**
 * Zod `z.string().trim().min(1)`: decode trims whitespace first, then the length
 * check runs on the trimmed result — so `"   "` is rejected and the output is the
 * trimmed string.
 */
const nonEmptyString = Schema.Trim.check(Schema.isMinLength(1));

/** Zod `z.number().int().min(MIN_SAFE_INTEGER).max(MAX_SAFE_INTEGER)`. */
const safeInt = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }),
);

/** Zod `safeInt.refine((value) => value >= 0)`. */
const nonNegativeSafeInt = safeInt.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * Zod v4 `z.string().datetime({ offset: true })` pattern, ported verbatim so the
 * timestamp stays a **plain string** on the wire (never a `DateTime` object).
 * Accepts `...Z`, `+HH:MM`, `-HH:MM`, and fractional seconds; rejects a missing
 * offset, a date-only value, and space-separated date/time.
 */
const DATETIME_OFFSET_RE =
  /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|([+-](?:[01]\d|2[0-3]):[0-5]\d)))$/;

/** Zod `z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM")`. */
const discoveryMonth = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Expected YYYY-MM" }),
);

export const NationBudgetChangedSchema = Schema.Struct({
  kind: Schema.Literal("NationBudgetChanged"),
  nationId: nonEmptyString,
  previousTreasury: safeInt,
  newTreasury: safeInt,
  delta: safeInt,
  reason: nonEmptyString,
});

export const ConstructionProgressedSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionProgressed"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  previousWork: nonNegativeSafeInt,
  newWork: nonNegativeSafeInt,
  workAdded: nonNegativeSafeInt,
});

export const ConstructionDelayedSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionDelayed"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  reason: nonEmptyString,
  delayMonth: discoveryMonth,
});

export const ShipRebuiltSchema = Schema.Struct({
  kind: Schema.Literal("ShipRebuilt"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromDesignVersionId: nonEmptyString,
  toDesignVersionId: nonEmptyString,
});

export const ConstructionProjectCancelledSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionProjectCancelled"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  projectType: nonEmptyString,
  consumedWork: nonNegativeSafeInt,
  refundedAmount: nonNegativeSafeInt,
  lostAmount: nonNegativeSafeInt,
  salvageableAmount: nonNegativeSafeInt,
  reason: nonEmptyString,
});

export const ResearchProgressedSchema = Schema.Struct({
  kind: Schema.Literal("ResearchProgressed"),
  nationId: nonEmptyString,
  techId: nonEmptyString,
  previousPoints: nonNegativeSafeInt,
  newPoints: nonNegativeSafeInt,
});

export const BattleInitiatedSchema = Schema.Struct({
  kind: Schema.Literal("BattleInitiated"),
  battleId: nonEmptyString,
  attackerId: nonEmptyString,
  defenderId: nonEmptyString,
  areaId: nonEmptyString,
});

export const BattleResolvedSchema = Schema.Struct({
  kind: Schema.Literal("BattleResolved"),
  battleId: nonEmptyString,
  winnerId: nonEmptyString,
  loserId: nonEmptyString,
});

export const TechnologyDiscoveredSchema = Schema.Struct({
  kind: Schema.Literal("TechnologyDiscovered"),
  nationId: nonEmptyString,
  techId: nonEmptyString,
  researchFieldId: nonEmptyString,
  discoveryMonth,
  cost: nonNegativeSafeInt,
});

export const ShipReadinessChangedSchema = Schema.Struct({
  kind: Schema.Literal("ShipReadinessChanged"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromReadiness: nonEmptyString,
  toReadiness: nonEmptyString,
  reason: nonEmptyString,
  crewQuality: nonNegativeSafeInt,
});

export const ShipStationAssignmentChangedSchema = Schema.Struct({
  kind: Schema.Literal("ShipStationAssignmentChanged"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromAssignment: nonEmptyString,
  toAssignment: nonEmptyString,
  reason: nonEmptyString,
});

export const DomainEventBodySchema = Schema.Union([
  NationBudgetChangedSchema,
  ConstructionProgressedSchema,
  ConstructionDelayedSchema,
  ShipRebuiltSchema,
  ConstructionProjectCancelledSchema,
  ResearchProgressedSchema,
  BattleInitiatedSchema,
  BattleResolvedSchema,
  TechnologyDiscoveredSchema,
  ShipReadinessChangedSchema,
  ShipStationAssignmentChangedSchema,
]);

export const DomainEventEnvelopeSchema = Schema.Struct({
  eventId: nonEmptyString,
  version: nonEmptyString,
  aggregateType: nonEmptyString,
  aggregateId: nonEmptyString,
  eventType: nonEmptyString,
  timestamp: Schema.String.check(Schema.isPattern(DATETIME_OFFSET_RE)),
  body: DomainEventBodySchema,
  sequenceNumber: nonNegativeSafeInt,
}).check(
  Schema.makeFilter((event) =>
    event.eventType === event.body.kind
      ? undefined
      : `eventType must match body.kind (${event.body.kind})`,
  ),
);

export function parseDomainEventBody(input: unknown): DomainEventBody {
  return Schema.decodeUnknownSync(DomainEventBodySchema, parseOptions)(input) as DomainEventBody;
}

export function parseDomainEventEnvelope<TBody extends DomainEventBody = DomainEventBody>(
  input: unknown,
): DomainEventEnvelope<TBody> {
  return Schema.decodeUnknownSync(
    DomainEventEnvelopeSchema,
    parseOptions,
  )(input) as DomainEventEnvelope<TBody>;
}
