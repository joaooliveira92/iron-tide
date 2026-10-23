import type {
  ExplanationPart,
  ExplanationText,
  ExplanationUnit,
  ExplanationValue,
} from "@bluewave/ship-design";

export const DEFAULT_EXPLANATION_LOCALE = "en-US";

type UnitSuffixes = Readonly<Record<ExplanationUnit, string>>;

const UNIT_SUFFIXES: Readonly<Record<string, UnitSuffixes>> = {
  [DEFAULT_EXPLANATION_LOCALE]: {
    ratio: "",
    percent: "%",
    percentSpaced: " %",
    percentOfLimit: " % of limit",
    trimPercent: " %L",
    knots: " kn",
    metres: " m",
    inches: " in",
  },
};

function suffixesFor(locale: string): UnitSuffixes {
  return UNIT_SUFFIXES[locale] ?? UNIT_SUFFIXES[DEFAULT_EXPLANATION_LOCALE]!;
}

export function formatExplanationValue(
  value: ExplanationValue,
  locale: string = DEFAULT_EXPLANATION_LOCALE,
): string {
  const display = value.value / value.scale;
  return `${display.toFixed(value.fractionDigits)}${suffixesFor(locale)[value.unit]}`;
}

export function formatExplanation(
  text: ExplanationText,
  locale: string = DEFAULT_EXPLANATION_LOCALE,
): string {
  if (typeof text === "string") return text;
  return text
    .map((part: ExplanationPart) =>
      typeof part === "string" ? part : formatExplanationValue(part, locale),
    )
    .join("");
}
