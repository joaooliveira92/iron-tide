import type { ExplanationTree } from "@bluewave/events";

import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { translate } from "../../lib/strings.js";
import { accuracyExplanationModel } from "./accuracy-explanation-model.js";

export function AccuracyDisclosure({
  tree,
  locale,
}: {
  readonly tree: ExplanationTree;
  readonly locale: FormattingLocale;
}) {
  const model = accuracyExplanationModel(tree, locale);
  return (
    <details className="w-full text-muted-foreground" data-testid="battle-accuracy">
      <summary className="cursor-pointer">
        {translate("battle.accuracy.summary", { result: model.resultText })}
      </summary>
      <ul className="mt-0.5 space-y-0.5 pl-3">
        <li>{translate("battle.accuracy.base", { value: model.baseText })}</li>
        {model.rows.length === 0 ? (
          <li>{translate("battle.accuracy.none")}</li>
        ) : (
          model.rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span>{row.changeText}</span>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
