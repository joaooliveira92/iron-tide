import type { ExplanationTree } from "@bluewave/events";

import { explanationModel } from "../../lib/explanation.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { translate } from "../../lib/strings.js";

export interface ExplanationDisclosureProps {
  readonly tree: ExplanationTree;
  readonly area: string;
  readonly summaryKey: string;
  readonly format: PresentationFormat;
  readonly testId?: string;
}

export function ExplanationDisclosure({
  tree,
  area,
  summaryKey,
  format,
  testId,
}: ExplanationDisclosureProps) {
  const model = explanationModel(tree, area, summaryKey, format);
  return (
    <details
      className="w-full text-xs text-muted-foreground"
      data-testid={testId ?? `explanation-${tree.formulaId}`}
    >
      <summary className="cursor-pointer">{model.summary}</summary>
      <ul className="mt-0.5 space-y-0.5 pl-3">
        {model.rows.length === 0 ? (
          <li>{translate(`${area}.explanation.none`)}</li>
        ) : (
          model.rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span className="tabular-nums">{row.valueText}</span>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
