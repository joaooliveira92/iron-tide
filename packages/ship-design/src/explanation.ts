export type ExplanationUnit =
  | "ratio"
  | "percent"
  | "percentSpaced"
  | "percentOfLimit"
  | "trimPercent"
  | "knots"
  | "metres"
  | "inches";

export interface ExplanationValue {
  readonly value: number;
  readonly scale: number;
  readonly fractionDigits: number;
  readonly unit: ExplanationUnit;
}

export type ExplanationPart = string | ExplanationValue;

export type ExplanationText = string | readonly ExplanationPart[];

export function quantity(
  value: number,
  scale: number,
  fractionDigits: number,
  unit: ExplanationUnit = "ratio",
): ExplanationValue {
  return { value, scale, fractionDigits, unit };
}

export function explanationIsEmpty(text: ExplanationText): boolean {
  if (typeof text === "string") return text.trim() === "";
  return text.length === 0;
}

export function explanationKey(text: ExplanationText): string {
  return typeof text === "string" ? text : JSON.stringify(text);
}
