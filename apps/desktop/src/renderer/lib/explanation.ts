import { BluewaveError } from "@bluewave/contracts";
import type { ExplanationTree } from "@bluewave/events";

import type { PresentationFormat } from "./presentation-format/index.js";
import { translate } from "./strings.js";

export function explanationLabelKey(area: string, formulaId: string): string {
  const segments = formulaId.split(".");
  if (segments.length !== 2 || segments.some((segment) => segment.length === 0)) {
    throw new BluewaveError("EXPLANATION_NODE_ID_INVALID", { formulaId });
  }
  return `${area}.${segments.join(".")}`;
}

export interface ExplanationRow {
  readonly key: string;
  readonly label: string;
  readonly valueText: string;
}

export interface ExplanationModel {
  readonly summary: string;
  readonly rows: readonly ExplanationRow[];
}

export function formatTreeValue(
  value: number,
  unit: string | undefined,
  format: PresentationFormat,
): string {
  if (unit === "bp") return format.percent(value, 1);
  return format.count(value);
}

export function explanationModel(
  tree: ExplanationTree,
  area: string,
  summaryKey: string,
  format: PresentationFormat,
): ExplanationModel {
  const rows = (tree.children ?? []).map((child): ExplanationRow => {
    return {
      key: child.formulaId,
      label: translate(explanationLabelKey(area, child.formulaId)),
      valueText: formatTreeValue(Number(child.result), child.unit ?? tree.unit, format),
    };
  });
  return {
    summary: translate(summaryKey, {
      value: formatTreeValue(Number(tree.result), tree.unit, format),
    }),
    rows,
  };
}
