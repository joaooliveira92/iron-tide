import type { ExplanationTree } from "@bluewave/events";

import { explanationLabelKey } from "../../lib/explanation.js";
import { formatPercent } from "../../lib/presentation-format/format.js";
import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { translate } from "../../lib/strings.js";

export { explanationLabelKey } from "../../lib/explanation.js";

const NEUTRAL_BP = 10_000;
const LABEL_AREA = "battle";

export interface AccuracyRow {
  readonly key: string;
  readonly label: string;
  readonly changeText: string;
}

export interface AccuracyExplanationModel {
  readonly baseText: string;
  readonly resultText: string;
  readonly rows: readonly AccuracyRow[];
}

const percent = (bp: number, locale: FormattingLocale) =>
  formatPercent(bp, { locale, maximumFractionDigits: 1 });

function changeText(multiplierBp: number, locale: FormattingLocale): string {
  const change = multiplierBp - NEUTRAL_BP;
  return `${change > 0 ? "+" : ""}${percent(change, locale)}`;
}

export function accuracyExplanationModel(
  tree: ExplanationTree,
  locale: FormattingLocale,
): AccuracyExplanationModel {
  const rows = (tree.children ?? []).map((child): AccuracyRow => {
    const key = child.formulaId.slice(child.formulaId.lastIndexOf(".") + 1);
    return {
      key,
      label: translate(explanationLabelKey(LABEL_AREA, child.formulaId)),
      changeText: changeText(Number(child.inputs["multiplierBp"]), locale),
    };
  });
  return {
    baseText: percent(Number(tree.inputs["baseAccuracyBp"]), locale),
    resultText: percent(Number(tree.result), locale),
    rows,
  };
}
