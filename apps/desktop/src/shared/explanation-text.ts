import type {
  ExplanationPart,
  ExplanationText,
  ExplanationUnit,
  ExplanationValue,
} from "@bluewave/ship-design";

export const DEFAULT_EXPLANATION_LOCALE = "en-US";

const UNIT_SUFFIX: Readonly<Record<ExplanationUnit, string>> = {
  ratio: "",
  percent: "%",
  percentSpaced: " %",
  percentOfLimit: " % of limit",
  trimPercent: " %L",
  knots: " kn",
  metres: " m",
  inches: " in",
};

export function formatExplanationValue(
  value: ExplanationValue,
  _locale: string = DEFAULT_EXPLANATION_LOCALE,
): string {
  const display = value.value / value.scale;
  return `${display.toFixed(value.fractionDigits)}${UNIT_SUFFIX[value.unit]}`;
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
