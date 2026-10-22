import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCode } from "@bluewave/diagnostics";

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

export class PrestigeNotInteger {
  readonly _tag = "PrestigeNotInteger";
  constructor(readonly value: number) {}
}

export class PrestigeUnsafeInteger {
  readonly _tag = "PrestigeUnsafeInteger";
  constructor(readonly value: number) {}
}

export class PrestigeOutOfRange {
  readonly _tag = "PrestigeOutOfRange";
  constructor(
    readonly value: number,
    readonly lowerBound: number,
    readonly upperBound: number,
  ) {}
}

export class PrestigeMissing {
  readonly _tag = "PrestigeMissing";
}

export class PrestigeUnknownReason {
  readonly _tag = "PrestigeUnknownReason";
  constructor(readonly reason: string) {}
}

export class PrestigeRuleMissing {
  readonly _tag = "PrestigeRuleMissing";
  constructor(readonly reason: string) {}
}

export class PrestigeDrawInvalid {
  readonly _tag = "PrestigeDrawInvalid";
  constructor(readonly draw: number) {}
}

export class PrestigeValueSetInvalid {
  readonly _tag = "PrestigeValueSetInvalid";
  constructor(
    readonly field: string,
    readonly message: string,
  ) {}
}

export class CareerResultInvalid {
  readonly _tag = "CareerResultInvalid";
  constructor(
    readonly field: string,
    readonly message: string,
  ) {}
}

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

export type PrestigeResult<Value, Error extends PrestigeError = PrestigeError> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: Error };

const succeed = <Value>(value: Value): { readonly ok: true; readonly value: Value } => ({
  ok: true,
  value,
});
const fail = <Error extends PrestigeError>(
  error: Error,
): { readonly ok: false; readonly error: Error } => ({
  ok: false,
  error,
});

function ceilDivBasisPoints(numerator: number): number {
  const remainder = numerator % BASIS_POINTS_PER_WHOLE;
  const whole = (numerator - remainder) / BASIS_POINTS_PER_WHOLE;
  return remainder === 0 ? whole : whole + 1;
}

function checkInteger(value: number): PrestigeResult<number> {
  if (!Number.isInteger(value)) return fail(new PrestigeNotInteger(value));
  if (!Number.isSafeInteger(value)) return fail(new PrestigeUnsafeInteger(value));
  return succeed(value);
}

function checkPrestige(value: number, set: PrestigeValueSet): PrestigeResult<SafeInt> {
  const integer = checkInteger(value);
  if (!integer.ok) return integer;
  if (value < set.lowerBound || value > set.upperBound) {
    return fail(new PrestigeOutOfRange(value, set.lowerBound, set.upperBound));
  }
  return succeed(SafeInt(value));
}

export function applyPrestigeRule(
  current: number,
  reason: PrestigeReasonCode,
  set: PrestigeValueSet,
  rule?: PrestigeRule,
): PrestigeResult<PrestigeChange> {
  if (!(PRESTIGE_REASON_CODES as readonly string[]).includes(reason)) {
    return fail(new PrestigeUnknownReason(String(reason)));
  }
  const checked = checkPrestige(current, set);
  if (!checked.ok) return checked;
  const before = checked.value;
  const applied: PrestigeRule | undefined = rule ?? set.rules[reason];
  if (applied === undefined) return fail(new PrestigeRuleMissing(reason));
  const rate = applied.kind === "PROPORTIONAL_LOSS" ? applied.basisPoints : applied.amount;
  const rateChecked = checkInteger(rate);
  if (!rateChecked.ok) return rateChecked;

  let target: number;
  if (applied.kind === "PROPORTIONAL_LOSS") {
    const product = before * applied.basisPoints;
    if (!Number.isSafeInteger(product)) return fail(new PrestigeUnsafeInteger(product));
    target = before - ceilDivBasisPoints(product);
  } else if (applied.kind === "FIXED_LOSS") {
    target = before - applied.amount;
  } else {
    target = before + applied.amount;
  }
  const after = Math.min(set.upperBound, Math.max(set.lowerBound, target));
  return succeed({ before, after: SafeInt(after), delta: SafeInt(after - before) });
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
  if (!checked.ok) return checked;
  if (!isSackingEligible(checked.value, set)) return succeed({ eligible: false });

  const value = draw();
  if (!Number.isInteger(value) || value < 0 || value >= BASIS_POINTS_PER_WHOLE) {
    return fail(new PrestigeDrawInvalid(value));
  }
  return succeed({
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
    return fail(new CareerResultInvalid("nationId", "must be a non-empty string"));
  }
  if (!(CAREER_END_REASONS as readonly string[]).includes(input.reason)) {
    return fail(new CareerResultInvalid("reason", "must be SACKED or CAMPAIGN_END"));
  }
  if (!Number.isSafeInteger(input.score) || input.score < 0) {
    return fail(new CareerResultInvalid("score", "must be a non-negative safe integer"));
  }
  if (!Number.isSafeInteger(input.month.year)) {
    return fail(new CareerResultInvalid("month.year", "must be a safe integer"));
  }
  if (!Number.isInteger(input.month.month) || input.month.month < 1 || input.month.month > 12) {
    return fail(new CareerResultInvalid("month.month", "must be an integer from 1 to 12"));
  }
  return succeed({
    nationId: input.nationId,
    score: SafeInt(input.score),
    reason: input.reason,
    month: { year: SafeInt(input.month.year), month: SafeInt(input.month.month) },
  });
}

const VALUE_SET_KEYS = [
  "lowerBound",
  "upperBound",
  "sackingThreshold",
  "sackingProbabilityBp",
  "rules",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, message: string) {
  return fail(new PrestigeValueSetInvalid(field, message));
}

function readInt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number,
  max: number,
): PrestigeResult<SafeInt, PrestigeValueSetInvalid> {
  const value = record[key];
  if (value === undefined) return invalid(path, "is required and has no default");
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return invalid(path, "must be a safe integer");
  }
  if (value < min || value > max) return invalid(path, `must be from ${min} to ${max}`);
  return succeed(SafeInt(value));
}

function excessKey(
  record: Record<string, unknown>,
  allowed: readonly string[],
  prefix: string,
): string | undefined {
  const extra = Object.keys(record).find((key) => !allowed.includes(key));
  return extra === undefined ? undefined : `${prefix}${extra}`;
}

function decodeRule(
  input: unknown,
  path: string,
  span: number,
): PrestigeResult<PrestigeRule, PrestigeValueSetInvalid> {
  if (!isRecord(input)) return invalid(path, "must be a rule record");
  if (input["kind"] === "PROPORTIONAL_LOSS") {
    const extra = excessKey(input, ["kind", "basisPoints"], `${path}.`);
    if (extra !== undefined) return invalid(extra, "is not a field of a proportional loss rule");
    const basisPoints = readInt(
      input,
      "basisPoints",
      `${path}.basisPoints`,
      0,
      BASIS_POINTS_PER_WHOLE,
    );
    return basisPoints.ok
      ? succeed({ kind: "PROPORTIONAL_LOSS", basisPoints: basisPoints.value })
      : basisPoints;
  }
  if (input["kind"] === "FIXED_GAIN") {
    const extra = excessKey(input, ["kind", "amount"], `${path}.`);
    if (extra !== undefined) return invalid(extra, "is not a field of a fixed gain rule");
    const amount = readInt(input, "amount", `${path}.amount`, 0, span);
    return amount.ok ? succeed({ kind: "FIXED_GAIN", amount: amount.value }) : amount;
  }
  if (input["kind"] === "FIXED_LOSS") {
    const extra = excessKey(input, ["kind", "amount"], `${path}.`);
    if (extra !== undefined) return invalid(extra, "is not a field of a fixed loss rule");
    const amount = readInt(input, "amount", `${path}.amount`, 0, span);
    return amount.ok ? succeed({ kind: "FIXED_LOSS", amount: amount.value }) : amount;
  }
  return invalid(`${path}.kind`, "must be PROPORTIONAL_LOSS, FIXED_GAIN or FIXED_LOSS");
}

export function decodePrestigeValueSet(
  input: unknown,
): PrestigeResult<PrestigeValueSet, PrestigeValueSetInvalid> {
  if (!isRecord(input)) return invalid("", "must be a record");
  const extra = excessKey(input, VALUE_SET_KEYS, "");
  if (extra !== undefined) return invalid(extra, "is not a field of a prestige value set");

  const lowerBound = readInt(input, "lowerBound", "lowerBound", 0, Number.MAX_SAFE_INTEGER);
  if (!lowerBound.ok) return lowerBound;
  const upperBound = readInt(input, "upperBound", "upperBound", 0, Number.MAX_SAFE_INTEGER);
  if (!upperBound.ok) return upperBound;
  if (upperBound.value <= lowerBound.value) {
    return invalid("upperBound", "must be greater than lowerBound");
  }
  const sackingThreshold = readInt(
    input,
    "sackingThreshold",
    "sackingThreshold",
    lowerBound.value,
    upperBound.value,
  );
  if (!sackingThreshold.ok) return sackingThreshold;
  const sackingProbabilityBp = readInt(
    input,
    "sackingProbabilityBp",
    "sackingProbabilityBp",
    0,
    BASIS_POINTS_PER_WHOLE,
  );
  if (!sackingProbabilityBp.ok) return sackingProbabilityBp;

  const rulesInput = input["rules"];
  if (rulesInput === undefined) return invalid("rules", "is required and has no default");
  if (!isRecord(rulesInput)) return invalid("rules", "must be a record");
  const extraRule = excessKey(rulesInput, PRESTIGE_REASON_CODES, "rules.");
  if (extraRule !== undefined) return invalid(extraRule, "is not a prestige reason code");

  const span = upperBound.value - lowerBound.value;
  const rules: Partial<Record<PrestigeReasonCode, PrestigeRule>> = {};
  for (const code of REQUIRED_PRESTIGE_REASON_CODES) {
    const rule = rulesInput[code];
    if (rule === undefined) return invalid(`rules.${code}`, "is required and has no default");
    const decoded = decodeRule(rule, `rules.${code}`, span);
    if (!decoded.ok) return decoded;
    rules[code] = decoded.value;
  }
  for (const code of OPTIONAL_PRESTIGE_REASON_CODES) {
    const rule = rulesInput[code];
    if (rule === undefined) continue;
    const decoded = decodeRule(rule, `rules.${code}`, span);
    if (!decoded.ok) return decoded;
    rules[code] = decoded.value;
  }

  return succeed({
    lowerBound: lowerBound.value,
    upperBound: upperBound.value,
    sackingThreshold: sackingThreshold.value,
    sackingProbabilityBp: sackingProbabilityBp.value,
    rules: rules as PrestigeValueSet["rules"],
  });
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
): PrestigeResult<SafeInt> {
  if (authored === undefined) return fail(new PrestigeMissing());
  if (typeof authored !== "number") return fail(new PrestigeNotInteger(Number.NaN));
  return checkPrestige(authored, set);
}
