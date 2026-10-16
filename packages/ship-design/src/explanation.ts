/**
 * Structured explanation data (ADR-0221, U-3 ticket 06). The domain never
 * formats a number for display: an explanation is ordered literal text plus
 * display-value tokens, and the presentation boundary renders it
 * (`apps/desktop/src/shared/explanation-text.ts`). Keep the surrounding prose as
 * literal parts so the rendered wording is unchanged.
 */

/** Stable unit codes; the presentation boundary maps each to a symbol and conversion. */
export type ExplanationUnit =
  | "ratio"
  | "percent"
  | "percentSpaced"
  | "percentOfLimit"
  | "trimPercent"
  | "knots"
  | "metres"
  | "inches";

/** A canonical number with its display conversion, precision, and stable unit code. */
export interface ExplanationValue {
  /** Canonical integer (basis points, milli-knots, millimetres, micrometres, or a plain ratio). */
  readonly value: number;
  /** Canonical→display divisor the boundary applies (e.g. 100, 1000, micrometres-per-inch). */
  readonly scale: number;
  /** Digits after the decimal point to render. */
  readonly fractionDigits: number;
  readonly unit: ExplanationUnit;
}

export type ExplanationPart = string | ExplanationValue;

/** An explanation: literal text and display-value tokens, or a plain string. */
export type ExplanationText = string | readonly ExplanationPart[];

/** A display-value token. */
export function quantity(
  value: number,
  scale: number,
  fractionDigits: number,
  unit: ExplanationUnit = "ratio",
): ExplanationValue {
  return { value, scale, fractionDigits, unit };
}

/** True when an explanation carries no text (used by the shape check). */
export function explanationIsEmpty(text: ExplanationText): boolean {
  if (typeof text === "string") return text.trim() === "";
  return text.length === 0;
}

/** A stable key for an explanation, for deterministic dedup and ordering. */
export function explanationKey(text: ExplanationText): string {
  return typeof text === "string" ? text : JSON.stringify(text);
}
