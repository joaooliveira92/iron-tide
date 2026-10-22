import { Schema } from "effect";

export const NationalCurrencyScaleSchema = Schema.Struct({
  numerator: Schema.Int,
  denominator: Schema.Int.check(Schema.isGreaterThan(0)),
}).annotate({ description: "Exact integer multiplier for a transform (never a float)" });

export const NationalCurrencyPeriodSchema = Schema.Struct({
  fromYear: Schema.Int,
  toYear: Schema.Int,
}).annotate({ description: "The years the configuration is valid for, inclusive" });

export const NationalCurrencyConfigurationSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  displayName: Schema.NonEmptyString,
  symbol: Schema.NonEmptyString,
  symbolPosition: Schema.Literals(["prefix", "suffix"]),
  spacing: Schema.Boolean,
  decimals: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4 })),
  grouping: Schema.Boolean,
  negatives: Schema.Literals(["minus", "parentheses"]),
  scale: Schema.NullOr(NationalCurrencyScaleSchema),
  period: NationalCurrencyPeriodSchema,
  source: Schema.NonEmptyString.annotate({ description: "A cited primary historical source" }),
  interpretation: Schema.Literals(["relabel", "transform"]),
}).annotate({ description: "One nation's validated National Historical currency" });

export type NationalCurrencyScale = typeof NationalCurrencyScaleSchema.Type;
export type NationalCurrencyPeriod = typeof NationalCurrencyPeriodSchema.Type;
export type NationalCurrencyConfiguration = typeof NationalCurrencyConfigurationSchema.Type;

export type NationalCurrencyDiagnosticReason =
  | "unidentified"
  | "symbol-only"
  | "floating-point-factor"
  | "unsourced"
  | "locale-conflicting"
  | "economy-altering";

export interface NationalCurrencyDiagnostic {
  readonly reason: NationalCurrencyDiagnosticReason;
  readonly message: string;
}

const PLACEHOLDER_SOURCES = new Set([
  "",
  "fixture",
  "todo",
  "tbd",
  "unknown",
  "n/a",
  "placeholder",
]);

export function validateNationalCurrencyConfiguration(
  config: NationalCurrencyConfiguration,
): readonly NationalCurrencyDiagnostic[] {
  const diagnostics: NationalCurrencyDiagnostic[] = [];
  if (config.id.trim() === "" || config.nationId.trim() === "") {
    diagnostics.push({ reason: "unidentified", message: "missing a stable id or nation id" });
  }
  if (config.displayName.trim() === "") {
    diagnostics.push({ reason: "symbol-only", message: "a symbol without a name" });
  }
  if (PLACEHOLDER_SOURCES.has(config.source.trim().toLowerCase())) {
    diagnostics.push({ reason: "unsourced", message: "no cited primary source" });
  }
  if (/[\d\s]/u.test(config.symbol)) {
    diagnostics.push({
      reason: "locale-conflicting",
      message: "the symbol contains a digit or whitespace and conflicts with number formatting",
    });
  }
  if (config.scale !== null) {
    const { numerator, denominator } = config.scale;
    if (
      !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator) ||
      denominator <= 0
    ) {
      diagnostics.push({
        reason: "floating-point-factor",
        message: "the scale is not an exact positive integer ratio",
      });
    }
  }
  if (config.interpretation === "relabel" && config.scale !== null) {
    diagnostics.push({ reason: "economy-altering", message: "a relabel must not scale the value" });
  }
  if (config.interpretation === "transform" && config.scale === null) {
    diagnostics.push({ reason: "economy-altering", message: "a transform must declare its scale" });
  }
  return diagnostics;
}

export function isValidNationalCurrencyConfiguration(
  config: NationalCurrencyConfiguration,
): boolean {
  return validateNationalCurrencyConfiguration(config).length === 0;
}
