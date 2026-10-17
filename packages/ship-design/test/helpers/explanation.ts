import type { ExplanationText, ExplanationUnit, ExplanationValue } from "../../src/explanation.js";

/**
 * Test-only renderer for the structured explanation data (ADR-0221). Mirrors the
 * presentation boundary (`apps/desktop/src/shared/explanation-text.ts`) so a
 * domain test can keep asserting the exact rendered strings it always did
 * without importing the app. Kept deliberately small; the boundary's own test
 * pins the same output.
 */
const SUFFIX: Readonly<Record<ExplanationUnit, string>> = {
  ratio: "",
  percent: "%",
  percentSpaced: " %",
  percentOfLimit: " % of limit",
  trimPercent: " %L",
  knots: " kn",
  metres: " m",
  inches: " in",
};

function value(token: ExplanationValue): string {
  const formatted = (token.value / token.scale).toFixed(token.fractionDigits);
  return `${formatted}${SUFFIX[token.unit]}`;
}

export function renderExplanation(text: ExplanationText): string {
  if (typeof text === "string") return text;
  return text.map((part) => (typeof part === "string" ? part : value(part))).join("");
}
