import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10_000 }));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const hullType = Schema.String.check(Schema.isMinLength(1));
const hullTypes = Schema.Array(hullType).check(Schema.isMinLength(1), Schema.isUnique());

export const AmcSurpriseRulesSchema = Schema.Struct({
  chanceBp: bp,
  startRangeM: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 100, maximum: 20_000 }),
  ),
});

export const RaiderInterceptionRulesSchema = Schema.Struct({
  amcSurprise: Schema.optional(AmcSurpriseRulesSchema),
  maxInterceptors: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 12 })),
  ),
  interceptBaseBp: bp,
  interceptPatrolBp: bp,
  breakoutInterceptBp: bp,
  raiderSunkBp: bp,
  maxEngagementDamageBp: bp,
  scuttleThresholdBp: bp,
  scuttleShareBp: bp,
  fuelInternBp: bp,
  breakdownInternBp: bp,
});

export const UnrestrictedWarfareRulesSchema = Schema.Struct({
  chanceMultiplierBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 10_000, maximum: 100_000 }),
  ),
  incidentBp: bp,
  neutralEntryBp: Schema.optional(bp),
});

const shareBp = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);

export const FleetSupportRulesSchema = Schema.Struct({
  chanceMultiplierBp: shareBp,
  quotaMultiplierBp: Schema.optional(shareBp),
});

export const SubmarineThreatRulesSchema = Schema.Struct({
  hullType,
  quotaPerBoatBp: bp,
  attackBp: bp,
  lossPerHitBp: bp,
  blockadeReductionBp: bp,
  aswEscortReductionBp: Schema.optional(bp),
  qShipReductionBp: Schema.optional(bp),
  unrestricted: Schema.optional(UnrestrictedWarfareRulesSchema),
  fleetSupport: Schema.optional(FleetSupportRulesSchema),
});

export const ShortfallPrestigeRulesSchema = Schema.Struct({
  thresholdBp: bp,
  lossBp: bp,
});

export const TradeProtectionRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  fleetShareBp: bp,
  resourcesPerRequiredShip: positiveInt,
  contributingHullTypes: hullTypes,
  raiderHullTypes: hullTypes,
  amcHullType: hullType,
  amcMinSpeedUms: positiveInt,
  raiderHitBp: bp,
  shortfallAmplifyBp: bp,
  lossPerHitBp: bp,
  pressureChanceBp: bp,
  pressureLossBp: bp,
  recoveryBpPerMonth: bp,
  revenueSensitivityBp: bp,
  unrestThresholdBp: bp,
  unrestCadenceMonths: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 24 }),
  ),
  unrestStep: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10 })),
  raiderInterception: Schema.optional(RaiderInterceptionRulesSchema),
  submarineThreat: Schema.optional(SubmarineThreatRulesSchema),
  shortfallPrestige: Schema.optional(ShortfallPrestigeRulesSchema),
  provenance: ProvenanceSchema,
});

export type RaiderInterceptionRules = typeof RaiderInterceptionRulesSchema.Type;

export type SubmarineThreatRules = typeof SubmarineThreatRulesSchema.Type;

export type ShortfallPrestigeRules = typeof ShortfallPrestigeRulesSchema.Type;

export type TradeProtectionRules = typeof TradeProtectionRulesSchema.Type;

export type TradeProtectionRulesDecoded =
  | { readonly ok: true; readonly value: TradeProtectionRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeTradeProtectionRules(input: unknown): TradeProtectionRulesDecoded {
  const result = Schema.decodeUnknownResult(TradeProtectionRulesSchema, {
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
