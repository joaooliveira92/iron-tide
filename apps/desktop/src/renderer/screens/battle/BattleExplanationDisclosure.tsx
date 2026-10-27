import type { ExplanationTree } from "@bluewave/events";

import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { translate } from "../../lib/strings.js";
import { battleExplanationModel } from "./battle-explanation-model.js";

export function BattleExplanationDisclosure({
  tree,
  locale,
  summaryKey,
}: {
  readonly tree: ExplanationTree;
  readonly locale: FormattingLocale;
  readonly summaryKey: string;
}) {
  const model = battleExplanationModel(tree, summaryKey, locale);
  return (
    <details
      className="w-full text-muted-foreground"
      data-testid={`battle-explanation-${tree.formulaId}`}
    >
      <summary className="cursor-pointer">{model.summary}</summary>
      <ul className="mt-0.5 space-y-0.5 pl-3">
        {model.rows.length === 0 ? (
          <li>{translate("battle.explanation.none")}</li>
        ) : (
          model.rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span>{row.valueText}</span>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
