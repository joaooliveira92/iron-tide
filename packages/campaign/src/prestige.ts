import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCode } from "@bluewave/diagnostics";
import { Data, Result, Schema } from "effect";

export const BASIS_POINTS_PER_WHOLE = 10_000;

export const PRESTIGE_REASON_CODES = [
  "UNPAID_FUNDS",
  "BATTLE_LOST",
  "BATTLE_WON",
  "DECLINED_BATTLE",
] as const;
export type PrestigeReasonCode = (typeof PRESTIGE_REASON_CODES)[number];

export const REQUIRED_PRESTIGE_REASON_CODES = [
  "UNPAID_FUNDS",
  "BATTLE_LOST",
  "BATTLE_WON",
] as const;
export type RequiredPrestigeReasonCode = (typeof REQUIRED_PRESTIGE_REASON_CODES)[number];

export const OPTIONAL_PRESTIGE_REASON_CODES = ["DECLINED_BATTLE"] as const;
export type OptionalPrestigeReasonCode = (typeof OPTIONAL_PRESTIGE_REASON_CODES)[number];

export const CAREER_END_REASONS = ["SACKED", "CAMPAIGN_END"] as const;
export type CareerEndReason = (typeof CAREER_END_REASONS)[number];

export interface ProportionalLossRule {
  readonly kind: "PROPORTIONAL_LOSS";
  readonly basisPoints: SafeInt;
}

export interface FixedGainRule {
  readonly kind: "FIXED_GAIN";
  readonly amount: SafeInt;
}

export interface FixedLossRule {
  readonly kind: "FIXED_LOSS";
  readonly amount: SafeInt;
}

export type PrestigeRule = ProportionalLossRule | FixedGainRule | FixedLossRule;

export interface PrestigeValueSet {
  readonly lowerBound: SafeInt;
  readonly upperBound: SafeInt;
  readonly sackingThreshold: SafeInt;
  readonly sackingProbabilityBp: SafeInt;
  readonly rules: Readonly<Record<RequiredPrestigeReasonCode, PrestigeRule>> &
    Readonly<Partial<Record<OptionalPrestigeReasonCode, PrestigeRule>>>;
}

export interface PrestigeChange {
  readonly before: SafeInt;
  readonly after: SafeInt;
  readonly delta: SafeInt;
}

export type SackingOutcome =
  | { readonly eligible: false }
  | { readonly eligible: true; readonly draw: SafeInt; readonly sacked: boolean };

export interface CareerMonth {
  readonly year: SafeInt;
  readonly month: SafeInt;
}

export interface CareerResult {
  readonly nationId: string;
  readonly score: SafeInt;
  readonly reason: CareerEndReason;
  readonly month: CareerMonth;
}

export class PrestigeNotInteger extends Data.TaggedError("PrestigeNotInteger")<{
  readonly value: number;
}> {}

export class PrestigeUnsafeInteger extends Data.TaggedError("PrestigeUnsafeInteger")<{
  readonly value: number;
}> {}

export class PrestigeOutOfRange extends Data.TaggedError("PrestigeOutOfRange")<{
  readonly value: number;
  readonly lowerBound: number;
  readonly upperBound: number;
}> {}

export class PrestigeMissing extends Data.TaggedError("PrestigeMissing")<{}> {}

export class PrestigeUnknownReason extends Data.TaggedError("PrestigeUnknownReason")<{
  readonly reason: string;
}> {}

export class PrestigeRuleMissing extends Data.TaggedError("PrestigeRuleMissing")<{
  readonly reason: string;
}> {}

export class PrestigeDrawInvalid extends Data.TaggedError("PrestigeDrawInvalid")<{
  readonly draw: number;
}> {}

export class PrestigeValueSetInvalid extends Data.TaggedError("PrestigeValueSetInvalid")<{
  readonly field: string;
  readonly message: string;
}> {}

export class CareerResultInvalid extends Data.TaggedError("CareerResultInvalid")<{
  readonly field: string;
  readonly message: string;
}> {}

export type PrestigeError =
  | PrestigeNotInteger
  | PrestigeUnsafeInteger
  | PrestigeOutOfRange
  | PrestigeMissing
  | PrestigeUnknownReason
  | PrestigeRuleMissing
  | PrestigeDrawInvalid
  | PrestigeValueSetInvalid
  | CareerResultInvalid;

export type PrestigeResult<Value, Error extends PrestigeError = PrestigeError> = Result.Result<
  Value,
  Error
>;

function ceilDivBasisPoints(numerator: number): number {
  const remainder = numerator % BASIS_POINTS_PER_WHOLE;
  const whole = (numerator - remainder) / BASIS_POINTS_PER_WHOLE;
  return remainder === 0 ? whole : whole + 1;
}

function checkInteger(
  value: number,
): PrestigeResult<number, PrestigeNotInteger | PrestigeUnsafeInteger> {
  if (!Number.isInteger(value)) return Result.fail(new PrestigeNotInteger({ value }));
  if (!Number.isSafeInteger(value)) return Result.fail(new PrestigeUnsafeInteger({ value }));
  return Result.succeed(value);
}

export type NationPrestigeError =
  | PrestigeMissing
  | PrestigeNotInteger
  | PrestigeUnsafeInteger
  | PrestigeOutOfRange;

function checkPrestige(
  value: number,
  set: PrestigeValueSet,
): PrestigeResult<SafeInt, PrestigeNotInteger | PrestigeUnsafeInteger | PrestigeOutOfRange> {
  const integer = checkInteger(value);
  if (Result.isFailure(integer)) return Result.fail(integer.failure);
  if (value < set.lowerBound || value > set.upperBound) {
    return Result.fail(
      new PrestigeOutOfRange({
        value,
        lowerBound: set.lowerBound,
        upperBound: set.upperBound,
      }),
    );
  }
  return Result.succeed(SafeInt(value));
}

export function applyPrestigeRule(
  current: number,
  reason: PrestigeReasonCode,
  set: PrestigeValueSet,
  rule?: PrestigeRule,
): PrestigeResult<PrestigeChange> {
  if (!(PRESTIGE_REASON_CODES as readonly string[]).includes(reason)) {
    return Result.fail(new PrestigeUnknownReason({ reason: String(reason) }));
  }
  const checked = checkPrestige(current, set);
  if (Result.isFailure(checked)) return Result.fail(checked.failure);
  const before = checked.success;
  const applied: PrestigeRule | undefined = rule ?? set.rules[reason];
  if (applied === undefined) return Result.fail(new PrestigeRuleMissing({ reason }));
  const rate = applied.kind === "PROPORTIONAL_LOSS" ? applied.basisPoints : applied.amount;
  const rateChecked = checkInteger(rate);
  if (Result.isFailure(rateChecked)) return Result.fail(rateChecked.failure);

  let target: number;
  if (applied.kind === "PROPORTIONAL_LOSS") {
    const product = before * applied.basisPoints;
    if (!Number.isSafeInteger(product))
      return Result.fail(new PrestigeUnsafeInteger({ value: product }));
    target = before - ceilDivBasisPoints(product);
  } else if (applied.kind === "FIXED_LOSS") {
    target = before - applied.amount;
  } else {
    target = before + applied.amount;
  }
  const after = Math.min(set.upperBound, Math.max(set.lowerBound, target));
  return Result.succeed({ before, after: SafeInt(after), delta: SafeInt(after - before) });
}

export function isSackingEligible(current: number, set: PrestigeValueSet): boolean {
  return current <= set.sackingThreshold;
}

export function resolveSacking(
  current: number,
  set: PrestigeValueSet,
  draw: () => number,
): PrestigeResult<SackingOutcome> {
  const checked = checkPrestige(current, set);
  if (Result.isFailure(checked)) return Result.fail(checked.failure);
  if (!isSackingEligible(checked.success, set)) return Result.succeed({ eligible: false });

  const value = draw();
  if (!Number.isInteger(value) || value < 0 || value >= BASIS_POINTS_PER_WHOLE) {
    return Result.fail(new PrestigeDrawInvalid({ draw: value }));
  }
  return Result.succeed({
    eligible: true,
    draw: SafeInt(value),
    sacked: value < set.sackingProbabilityBp,
  });
}

export interface CareerResultInput {
  readonly nationId: string;
  readonly score: number;
  readonly reason: CareerEndReason;
  readonly month: { readonly year: number; readonly month: number };
}

export function buildCareerResult(input: CareerResultInput): PrestigeResult<CareerResult> {
  if (typeof input.nationId !== "string" || input.nationId === "") {
    return Result.fail(
      new CareerResultInvalid({ field: "nationId", message: "must be a non-empty string" }),
    );
  }
  if (!(CAREER_END_REASONS as readonly string[]).includes(input.reason)) {
    return Result.fail(
      new CareerResultInvalid({ field: "reason", message: "must be SACKED or CAMPAIGN_END" }),
    );
  }
  if (!Number.isSafeInteger(input.score) || input.score < 0) {
    return Result.fail(
      new CareerResultInvalid({
        field: "score",
        message: "must be a non-negative safe integer",
      }),
    );
  }
  if (!Number.isSafeInteger(input.month.year)) {
    return Result.fail(
      new CareerResultInvalid({ field: "month.year", message: "must be a safe integer" }),
    );
  }
  if (!Number.isInteger(input.month.month) || input.month.month < 1 || input.month.month > 12) {
    return Result.fail(
      new CareerResultInvalid({
        field: "month.month",
        message: "must be an integer from 1 to 12",
      }),
    );
  }
  return Result.succeed({
    nationId: input.nationId,
    score: SafeInt(input.score),
    reason: input.reason,
    month: { year: SafeInt(input.month.year), month: SafeInt(input.month.month) },
  });
}

const SAFE_INTEGER_MESSAGE = "must be a safe integer";
const REQUIRED_MESSAGE = "is required and has no default";

export function boundedSafeInteger(min: number, max: number) {
  return Schema.Number.check(
    Schema.makeFilter((n: number) => Number.isSafeInteger(n) || SAFE_INTEGER_MESSAGE),
    Schema.makeFilter((n: number) => (n >= min && n <= max) || `must be from ${min} to ${max}`),
  );
}

const nonNegativeSafeInteger = boundedSafeInteger(0, Number.MAX_SAFE_INTEGER);
const basisPointsInteger = boundedSafeInteger(0, BASIS_POINTS_PER_WHOLE);

const ProportionalLossRuleSchema = Schema.Struct({
  kind: Schema.Literal("PROPORTIONAL_LOSS"),
  basisPoints: basisPointsInteger,
});
const FixedGainRuleSchema = Schema.Struct({
  kind: Schema.Literal("FIXED_GAIN"),
  amount: nonNegativeSafeInteger,
});
const FixedLossRuleSchema = Schema.Struct({
  kind: Schema.Literal("FIXED_LOSS"),
  amount: nonNegativeSafeInteger,
});

export const PrestigeRuleSchema = Schema.Union([
  ProportionalLossRuleSchema,
  FixedGainRuleSchema,
  FixedLossRuleSchema,
]);

type DecodedRule = typeof PrestigeRuleSchema.Type;

interface Violation {
  readonly path: ReadonlyArray<string>;
  readonly message: string;
}

function leafMessage(schema: Schema.Top, value: unknown): string | undefined {
  const decoded = Schema.decodeUnknownResult(schema as Schema.Decoder<unknown>, {
    onExcessProperty: "error",
  })(value);
  if (Result.isSuccess(decoded)) return undefined;
  return decoded.failure.issue._tag === "InvalidType"
    ? SAFE_INTEGER_MESSAGE
    : decoded.failure.message;
}

function relationViolation(set: {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly sackingThreshold: number;
  readonly rules: Readonly<Partial<Record<PrestigeReasonCode, DecodedRule>>>;
}): Violation | undefined {
  if (set.upperBound <= set.lowerBound) {
    return { path: ["upperBound"], message: "must be greater than lowerBound" };
  }
  const thresholdMessage = leafMessage(
    boundedSafeInteger(set.lowerBound, set.upperBound),
    set.sackingThreshold,
  );
  if (thresholdMessage !== undefined) {
    return { path: ["sackingThreshold"], message: thresholdMessage };
  }
  const span = set.upperBound - set.lowerBound;
  for (const code of [...REQUIRED_PRESTIGE_REASON_CODES, ...OPTIONAL_PRESTIGE_REASON_CODES]) {
    const rule = set.rules[code];
    if (rule === undefined || rule.kind === "PROPORTIONAL_LOSS") continue;
    const message = leafMessage(boundedSafeInteger(0, span), rule.amount);
    if (message !== undefined) return { path: ["rules", code, "amount"], message };
  }
  return undefined;
}

const PrestigeRulesSchema = Schema.Struct({
  UNPAID_FUNDS: PrestigeRuleSchema,
  BATTLE_LOST: PrestigeRuleSchema,
  BATTLE_WON: PrestigeRuleSchema,
  DECLINED_BATTLE: Schema.optional(PrestigeRuleSchema),
});

export const PrestigeValueSetSchema = Schema.Struct({
  lowerBound: nonNegativeSafeInteger,
  upperBound: nonNegativeSafeInteger,
  sackingThreshold: nonNegativeSafeInteger,
  sackingProbabilityBp: basisPointsInteger,
  rules: PrestigeRulesSchema,
}).check(
  Schema.makeFilter((set) => {
    const violation = relationViolation(set);
    return violation === undefined ? true : { path: violation.path, issue: violation.message };
  }),
);

const decodeValueSet = Schema.decodeUnknownResult(PrestigeValueSetSchema, {
  errors: "all",
  onExcessProperty: "error",
});

const VALUE_SET_KEYS: ReadonlyArray<string> = Object.keys(PrestigeValueSetSchema.fields);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, message: string) {
  return new PrestigeValueSetInvalid({ field, message });
}

function firstExcessKey(record: Record<string, unknown>, allowed: ReadonlyArray<string>) {
  return Object.keys(record).find((key) => !allowed.includes(key));
}

function leafFailure(
  record: Record<string, unknown>,
  key: string,
  path: string,
  schema: Schema.Top,
): PrestigeValueSetInvalid | undefined {
  const value = record[key];
  if (value === undefined) return invalid(path, REQUIRED_MESSAGE);
  const message = leafMessage(schema, value);
  return message === undefined ? undefined : invalid(path, message);
}

const RULE_KIND_LABEL = {
  PROPORTIONAL_LOSS: "proportional loss",
  FIXED_GAIN: "fixed gain",
  FIXED_LOSS: "fixed loss",
} as const;

function ruleFailure(
  input: unknown,
  path: string,
  span: number,
): PrestigeValueSetInvalid | undefined {
  if (!isRecord(input)) return invalid(path, "must be a rule record");
  const kind = input["kind"];
  if (kind !== "PROPORTIONAL_LOSS" && kind !== "FIXED_GAIN" && kind !== "FIXED_LOSS") {
    return invalid(`${path}.kind`, "must be PROPORTIONAL_LOSS, FIXED_GAIN or FIXED_LOSS");
  }
  const valueKey = kind === "PROPORTIONAL_LOSS" ? "basisPoints" : "amount";
  const extra = firstExcessKey(input, ["kind", valueKey]);
  if (extra !== undefined) {
    return invalid(`${path}.${extra}`, `is not a field of a ${RULE_KIND_LABEL[kind]} rule`);
  }
  return leafFailure(
    input,
    valueKey,
    `${path}.${valueKey}`,
    kind === "PROPORTIONAL_LOSS" ? basisPointsInteger : boundedSafeInteger(0, span),
  );
}

function valueSetFailure(input: unknown): PrestigeValueSetInvalid | undefined {
  if (!isRecord(input)) return invalid("", "must be a record");
  const extra = firstExcessKey(input, VALUE_SET_KEYS);
  if (extra !== undefined) return invalid(extra, "is not a field of a prestige value set");

  const lowerBound = leafFailure(input, "lowerBound", "lowerBound", nonNegativeSafeInteger);
  if (lowerBound !== undefined) return lowerBound;
  const upperBound = leafFailure(input, "upperBound", "upperBound", nonNegativeSafeInteger);
  if (upperBound !== undefined) return upperBound;
  const lower = Number(input["lowerBound"]);
  const upper = Number(input["upperBound"]);
  if (upper <= lower) return invalid("upperBound", "must be greater than lowerBound");
  const threshold = leafFailure(
    input,
    "sackingThreshold",
    "sackingThreshold",
    boundedSafeInteger(lower, upper),
  );
  if (threshold !== undefined) return threshold;
  const probability = leafFailure(
    input,
    "sackingProbabilityBp",
    "sackingProbabilityBp",
    basisPointsInteger,
  );
  if (probability !== undefined) return probability;

  const rules = input["rules"];
  if (rules === undefined) return invalid("rules", REQUIRED_MESSAGE);
  if (!isRecord(rules)) return invalid("rules", "must be a record");
  const extraRule = firstExcessKey(rules, PRESTIGE_REASON_CODES);
  if (extraRule !== undefined)
    return invalid(`rules.${extraRule}`, "is not a prestige reason code");

  const span = upper - lower;
  for (const code of REQUIRED_PRESTIGE_REASON_CODES) {
    if (rules[code] === undefined) return invalid(`rules.${code}`, REQUIRED_MESSAGE);
    const failure = ruleFailure(rules[code], `rules.${code}`, span);
    if (failure !== undefined) return failure;
  }
  for (const code of OPTIONAL_PRESTIGE_REASON_CODES) {
    if (rules[code] === undefined) continue;
    const failure = ruleFailure(rules[code], `rules.${code}`, span);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function brandRule(rule: DecodedRule): PrestigeRule {
  return rule.kind === "PROPORTIONAL_LOSS"
    ? { kind: rule.kind, basisPoints: SafeInt(rule.basisPoints) }
    : { kind: rule.kind, amount: SafeInt(rule.amount) };
}

function brandValueSet(decoded: typeof PrestigeValueSetSchema.Type): PrestigeValueSet {
  const { DECLINED_BATTLE, ...required } = decoded.rules;
  return {
    lowerBound: SafeInt(decoded.lowerBound),
    upperBound: SafeInt(decoded.upperBound),
    sackingThreshold: SafeInt(decoded.sackingThreshold),
    sackingProbabilityBp: SafeInt(decoded.sackingProbabilityBp),
    rules: {
      UNPAID_FUNDS: brandRule(required.UNPAID_FUNDS),
      BATTLE_LOST: brandRule(required.BATTLE_LOST),
      BATTLE_WON: brandRule(required.BATTLE_WON),
      ...(DECLINED_BATTLE === undefined ? {} : { DECLINED_BATTLE: brandRule(DECLINED_BATTLE) }),
    },
  };
}

export function decodePrestigeValueSet(
  input: unknown,
): PrestigeResult<PrestigeValueSet, PrestigeValueSetInvalid> {
  if (!isRecord(input)) return Result.fail(invalid("", "must be a record"));
  const decoded = decodeValueSet(input);
  if (Result.isSuccess(decoded)) return Result.succeed(brandValueSet(decoded.success));
  return Result.fail(valueSetFailure(input) ?? invalid("", "is not a valid prestige value set"));
}

export const PRESTIGE_COMPILE_CODES = {
  missing: "CAMPAIGN-PRESTIGE-MISSING" as DiagnosticCode,
  notInteger: "CAMPAIGN-PRESTIGE-NOT-INTEGER" as DiagnosticCode,
  unsafeInteger: "CAMPAIGN-PRESTIGE-UNSAFE-INTEGER" as DiagnosticCode,
  outOfRange: "CAMPAIGN-PRESTIGE-OUT-OF-RANGE" as DiagnosticCode,
  valueSetMissing: "CAMPAIGN-PRESTIGE-VALUE-SET-MISSING" as DiagnosticCode,
  valueSetInvalid: "CAMPAIGN-PRESTIGE-VALUE-SET-INVALID" as DiagnosticCode,
  valueSetAmbiguous: "CAMPAIGN-PRESTIGE-VALUE-SET-AMBIGUOUS" as DiagnosticCode,
} as const;

export function resolveNationPrestige(
  authored: unknown,
  set: PrestigeValueSet,
): PrestigeResult<SafeInt, NationPrestigeError> {
  if (authored === undefined) return Result.fail(new PrestigeMissing());
  if (typeof authored !== "number")
    return Result.fail(new PrestigeNotInteger({ value: Number.NaN }));
  return checkPrestige(authored, set);
}
