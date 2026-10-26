import type { ExplanationTree } from "@bluewave/events";

import { formatPercent } from "../../lib/presentation-format/index.js";
import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { translate } from "../../lib/strings.js";

const NEUTRAL_BP = 10_000;
const FACTOR_PREFIX = "gunnery_accuracy.";

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
    const key = child.formulaId.startsWith(FACTOR_PREFIX)
      ? child.formulaId.slice(FACTOR_PREFIX.length)
      : child.formulaId;
    return {
      key,
      label: translate(`battle.accuracy.factor.${key}`),
      changeText: changeText(Number(child.inputs["multiplierBp"]), locale),
    };
  });
  return {
    baseText: percent(Number(tree.inputs["baseAccuracyBp"]), locale),
    resultText: percent(Number(tree.result), locale),
    rows,
  };
}
