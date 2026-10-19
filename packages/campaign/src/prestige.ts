// S-2 (prestige and career): the value-free, pure prestige rule layer (spec #74 R1).
//
// This module holds the shapes and arithmetic only. It carries NO prestige value and NO default:
// every number a rule needs (bounds, the sacking threshold and probability, each source's rate or
// gain) arrives in a `PrestigeValueSet` the caller supplies, strictly decoded here. The production
// values are authored later from ADR-0239; nothing here reads state, content, time or randomness.
//
// `campaign` is renderer-reachable, so failures are plain classes with a readonly `_tag` and never
// `Data.TaggedError` (ADR-0128 §1, MIG-EXCL-1). All arithmetic is exact integer arithmetic.
import { SafeInt } from "@bluewave/contracts";

/** Basis points in one whole (a proportional loss rate and a sacking probability are in bp). */
export const BASIS_POINTS_PER_WHOLE = 10_000;

/** The closed, stable set of prestige sources S-2 wires. Later sprints add codes through the same seam. */
export const PRESTIGE_REASON_CODES = ["UNPAID_FUNDS", "BATTLE_LOST", "BATTLE_WON"] as const;
export type PrestigeReasonCode = (typeof PRESTIGE_REASON_CODES)[number];

/** Why a career ended: the player was sacked, or the campaign reached its final month in office. */
export const CAREER_END_REASONS = ["SACKED", "CAMPAIGN_END"] as const;
export type CareerEndReason = (typeof CAREER_END_REASONS)[number];

/** A loss taken as basis points of current prestige, so the mighty lose more in absolute terms. */
export interface ProportionalLossRule {
  readonly kind: "PROPORTIONAL_LOSS";
  readonly basisPoints: SafeInt;
}

/** A fixed gain, independent of current prestige. */
export interface FixedGainRule {
  readonly kind: "FIXED_GAIN";
  readonly amount: SafeInt;
}

export type PrestigeRule = ProportionalLossRule | FixedGainRule;

/** Everything the rule layer needs and nothing it assumes. There is deliberately no default instance. */
export interface PrestigeValueSet {
  readonly lowerBound: SafeInt;
  readonly upperBound: SafeInt;
  /** At or below this, each month carries a recorded chance of being sacked. */
  readonly sackingThreshold: SafeInt;
  /** Chance of being sacked in a month at or below the threshold, in basis points (0..10000). */
  readonly sackingProbabilityBp: SafeInt;
  readonly rules: Readonly<Record<PrestigeReasonCode, PrestigeRule>>;
}

export interface PrestigeChange {
  readonly before: SafeInt;
  readonly after: SafeInt;
  /** `after - before`: what was actually applied, after clamping to the bounds. */
  readonly delta: SafeInt;
}

export type SackingOutcome =
  | { readonly eligible: false }
  | { readonly eligible: true; readonly draw: SafeInt; readonly sacked: boolean };

export interface CareerMonth {
  readonly year: SafeInt;
  readonly month: SafeInt;
}

/** The authoritative result of a career that has ended. The score is the prestige held, unconverted. */
export interface CareerResult {
  readonly nationId: string;
  readonly score: SafeInt;
  readonly reason: CareerEndReason;
  readonly month: CareerMonth;
}

// -- Errors. Each has a stable `_tag`; callers discriminate by it, never by `instanceof`. ----------

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

export class PrestigeUnknownReason {
  readonly _tag = "PrestigeUnknownReason";
  constructor(readonly reason: string) {}
}

export class PrestigeDrawInvalid {
  readonly _tag = "PrestigeDrawInvalid";
  constructor(readonly draw: number) {}
}

/** The value set (or one of its fields) is malformed; `field` is the dotted path to the culprit. */
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
  | PrestigeUnknownReason
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

// -- Arithmetic. ---------------------------------------------------------------------------------

/**
 * `ceil(numerator / BASIS_POINTS_PER_WHOLE)` for a non-negative safe integer, in exact integer
 * arithmetic (no floating-point division, so no off-by-one at a boundary). Rounding UP is the
 * documented rule for a proportional loss: a loss is never rounded away to nothing, and a loss at
 * the .5 boundary rounds against the player (5% of 25 is 1.25 and costs 2).
 */
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

/** A prestige value that is a safe integer within the ruleset's bounds. */
function checkPrestige(value: number, set: PrestigeValueSet): PrestigeResult<SafeInt> {
  const integer = checkInteger(value);
  if (!integer.ok) return integer;
  if (value < set.lowerBound || value > set.upperBound) {
    return fail(new PrestigeOutOfRange(value, set.lowerBound, set.upperBound));
  }
  return succeed(SafeInt(value));
}

/**
 * Apply one source's rule to current prestige.
 *
 * - Proportional loss: `loss = ceil(current * basisPoints / 10000)` (rounded up, see
 *   `ceilDivBasisPoints`), then `after = max(lowerBound, current - loss)`.
 * - Fixed gain: `after = min(upperBound, current + amount)`.
 *
 * `delta` is what was actually applied after clamping, so a change at a bound is smaller than the
 * rule asked for, and zero when nothing moved. The result never leaves the ruleset bounds.
 */
export function applyPrestigeRule(
  current: number,
  reason: PrestigeReasonCode,
  set: PrestigeValueSet,
): PrestigeResult<PrestigeChange> {
  if (!(PRESTIGE_REASON_CODES as readonly string[]).includes(reason)) {
    return fail(new PrestigeUnknownReason(String(reason)));
  }
  const checked = checkPrestige(current, set);
  if (!checked.ok) return checked;
  const before = checked.value;
  const rule = set.rules[reason];

  let target: number;
  if (rule.kind === "PROPORTIONAL_LOSS") {
    const product = before * rule.basisPoints;
    if (!Number.isSafeInteger(product)) return fail(new PrestigeUnsafeInteger(product));
    target = before - ceilDivBasisPoints(product);
  } else {
    target = before + rule.amount;
  }
  const after = Math.min(set.upperBound, Math.max(set.lowerBound, target));
  return succeed({ before, after: SafeInt(after), delta: SafeInt(after - before) });
}

// -- Sacking. ------------------------------------------------------------------------------------

/** Whether a month at this prestige carries a chance of being sacked (at or below the threshold). */
export function isSackingEligible(current: number, set: PrestigeValueSet): boolean {
  return current <= set.sackingThreshold;
}

/**
 * Resolve a month's sacking risk. `draw` is called at most once and ONLY when prestige is at or
 * below the threshold, so no randomness is consumed above it. The draw is an integer in
 * `0..BASIS_POINTS_PER_WHOLE - 1` and the player is sacked when it falls below the supplied
 * probability, so a probability of 0 never sacks and 10000 always does; neither is substituted.
 * The caller owns the recorded, domain-separated stream the draw comes from.
 */
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

// -- Career result. ------------------------------------------------------------------------------

export interface CareerResultInput {
  readonly nationId: string;
  readonly score: number;
  readonly reason: CareerEndReason;
  readonly month: { readonly year: number; readonly month: number };
}

/** Build the career result, validating every field. The score is the prestige held, unconverted. */
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

// -- Strict value-set decoding. ------------------------------------------------------------------

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

/** A required safe-integer field within `min..max`. There is never a default for a missing one. */
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

/** The first key of `record` that is not in `allowed`, as a dotted path, or undefined. */
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
  return invalid(`${path}.kind`, "must be PROPORTIONAL_LOSS or FIXED_GAIN");
}

/**
 * Strictly decode a prestige value set from untrusted input. Excess keys are rejected at every
 * level, every field is required (there is no default anywhere), integers must be safe, and the
 * bounds must be ordered with the sacking threshold between them. A malformed set is a
 * `PrestigeValueSetInvalid` naming the offending field.
 */
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
  for (const code of PRESTIGE_REASON_CODES) {
    const rule = rulesInput[code];
    if (rule === undefined) return invalid(`rules.${code}`, "is required and has no default");
    const decoded = decodeRule(rule, `rules.${code}`, span);
    if (!decoded.ok) return decoded;
    rules[code] = decoded.value;
  }

  return succeed({
    lowerBound: lowerBound.value,
    upperBound: upperBound.value,
    sackingThreshold: sackingThreshold.value,
    sackingProbabilityBp: sackingProbabilityBp.value,
    rules: rules as Record<PrestigeReasonCode, PrestigeRule>,
  });
}
