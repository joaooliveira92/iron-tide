/**
 * The structured-explanation renderer (ADR-0221). The domain emits literal text
 * plus display-value tokens and never formats a number; this boundary joins the
 * parts and renders each token as its canonical fixed decimal with the unit
 * code's symbol. It lives in `shared/` so the main process, the renderer, and
 * the frozen `CommandRejected.diagnostics` string channel all render the same
 * data.
 *
 * Effect-free and pure. Re-exported from the single presentation home
 * (`renderer/lib/presentation-format/`) for components.
 */
import type {
  ExplanationPart,
  ExplanationText,
  ExplanationUnit,
  ExplanationValue,
} from "@bluewave/ship-design";

/** The default formatting locale; matches the canonical en-US rendering. */
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

/**
 * Render one display-value token (canonical value → display number + unit symbol).
 *
 * The number is rendered with the canonical fixed decimal (`toFixed`), so every
 * migrated explanation is byte-identical to the value the domain used to build;
 * this renderer is the presentation home allowed to format. Locale-aware
 * rendering is a later migration (U-3 map D5 / U-4).
 */
export function formatExplanationValue(
  value: ExplanationValue,
  _locale: string = DEFAULT_EXPLANATION_LOCALE,
): string {
  const display = value.value / value.scale;
  return `${display.toFixed(value.fractionDigits)}${UNIT_SUFFIX[value.unit]}`;
}

/** Render an explanation (or pass a plain string through unchanged). */
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
