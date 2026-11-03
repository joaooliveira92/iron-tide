import { Schema } from "effect";

import { GovernmentTypeSchema, NationTraitSchema } from "./nation.js";
import { ProvenanceSchema } from "./provenance.js";

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const int = Schema.Finite.check(Schema.isInt());
const positiveInt = int.check(Schema.isGreaterThan(0));
const tensionLevel = int.check(Schema.isBetween({ minimum: 0, maximum: 10 }));
const tensionDelta = int.check(Schema.isBetween({ minimum: -10, maximum: 10 }));
const unrestDelta = int.check(Schema.isBetween({ minimum: -10, maximum: 10 }));
const budgetDeltaBp = int.check(Schema.isBetween({ minimum: -10_000, maximum: 10_000 }));
const basisPoints = int.check(Schema.isBetween({ minimum: 1, maximum: 10_000 }));
const identifier = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z][a-z0-9_]*$/));
const reasonCode = Schema.NonEmptyString.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/));

export const EVENT_STANCES = ["hawk", "dove", "neutral"] as const;
export const EventStanceSchema = Schema.Literals(EVENT_STANCES);
export type EventStance = typeof EventStanceSchema.Type;

export const EVENT_COUNTERPART_ROLES = ["highest_tension_rival", "war_enemy"] as const;
export const EventCounterpartRoleSchema = Schema.Literals(EVENT_COUNTERPART_ROLES);
export type EventCounterpartRole = typeof EventCounterpartRoleSchema.Type;

export const EventPrestigeEffectSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("FIXED_GAIN"), amount: positiveInt, reasonCode }),
  Schema.Struct({ kind: Schema.Literal("FIXED_LOSS"), amount: positiveInt, reasonCode }),
  Schema.Struct({ kind: Schema.Literal("PROPORTIONAL_LOSS"), basisPoints, reasonCode }),
]);
export type EventPrestigeEffect = typeof EventPrestigeEffectSchema.Type;

export const EventEffectsSchema = Schema.Struct({
  budgetBp: budgetDeltaBp,
  prestige: Schema.optional(EventPrestigeEffectSchema),
  unrest: unrestDelta,
  tension: Schema.optional(
    Schema.Struct({ counterpart: EventCounterpartRoleSchema, delta: tensionDelta }),
  ),
  setFlag: Schema.optional(identifier),
});
export type EventEffects = typeof EventEffectsSchema.Type;

export const EventGatesSchema = Schema.Struct({
  governmentTypes: Schema.optional(
    Schema.Array(GovernmentTypeSchema).check(Schema.isMinLength(1), Schema.isUnique()),
  ),
  eraWindow: Schema.optional(
    Schema.Struct({ fromMonth: month, toMonth: month }).check(
      Schema.makeFilter((window) =>
        window.fromMonth <= window.toMonth ? undefined : "fromMonth must not be after toMonth",
      ),
    ),
  ),
  tension: Schema.optional(
    Schema.Struct({
      counterpart: EventCounterpartRoleSchema,
      min: tensionLevel,
      max: tensionLevel,
    }).check(
      Schema.makeFilter((range) =>
        range.min <= range.max ? undefined : "min must not exceed max",
      ),
    ),
  ),
  requiredTraits: Schema.optional(Schema.Array(NationTraitSchema).check(Schema.isUnique())),
  excludedTraits: Schema.optional(Schema.Array(NationTraitSchema).check(Schema.isUnique())),
  requiredFlags: Schema.optional(Schema.Array(identifier).check(Schema.isUnique())),
  excludedFlags: Schema.optional(Schema.Array(identifier).check(Schema.isUnique())),
});
export type EventGates = typeof EventGatesSchema.Type;

export const EventAnswerSchema = Schema.Struct({
  id: identifier,
  stance: EventStanceSchema,
  labelKey: Schema.NonEmptyString,
  effects: EventEffectsSchema,
});
export type EventAnswer = typeof EventAnswerSchema.Type;

function stanceSignViolation(answer: EventAnswer): string | undefined {
  const { effects } = answer;
  const tensionChange = effects.tension?.delta ?? 0;
  if (answer.stance === "hawk") {
    if (effects.budgetBp < 0) return `hawk answer '${answer.id}' must not lower the budget`;
    if (effects.unrest < 0) return `hawk answer '${answer.id}' must not lower unrest`;
    if (tensionChange < 0) return `hawk answer '${answer.id}' must not lower tension`;
    if (effects.prestige !== undefined && effects.prestige.kind !== "FIXED_GAIN") {
      return `hawk answer '${answer.id}' must not lose prestige`;
    }
  }
  if (answer.stance === "dove") {
    if (effects.budgetBp > 0) return `dove answer '${answer.id}' must not raise the budget`;
    if (effects.unrest > 0) return `dove answer '${answer.id}' must not raise unrest`;
    if (tensionChange > 0) return `dove answer '${answer.id}' must not raise tension`;
    if (effects.prestige !== undefined && effects.prestige.kind === "FIXED_GAIN") {
      return `dove answer '${answer.id}' must not gain prestige`;
    }
  }
  return undefined;
}

export const EventSchema = Schema.Struct({
  id: identifier,
  titleKey: Schema.NonEmptyString,
  bodyKey: Schema.NonEmptyString,
  gates: EventGatesSchema,
  weightBp: basisPoints,
  cooldownMonths: int.check(Schema.isGreaterThanOrEqualTo(0)),
  once: Schema.Boolean,
  defaultAnswerId: identifier,
  answers: Schema.Array(EventAnswerSchema).check(Schema.isMinLength(2)),
  provenance: ProvenanceSchema,
}).check(
  Schema.makeFilter((event) => {
    const ids = event.answers.map((answer) => answer.id);
    if (new Set(ids).size !== ids.length) return "answer ids must be unique";
    if (!ids.includes(event.defaultAnswerId)) {
      return `defaultAnswerId '${event.defaultAnswerId}' is not one of the answers`;
    }
    if (!event.answers.some((answer) => answer.stance === "hawk")) {
      return "an event needs a hawk answer";
    }
    if (!event.answers.some((answer) => answer.stance === "dove")) {
      return "an event needs a dove answer";
    }
    for (const answer of event.answers) {
      const violation = stanceSignViolation(answer);
      if (violation !== undefined) return violation;
    }
    return undefined;
  }),
);
export type GameEvent = typeof EventSchema.Type;
