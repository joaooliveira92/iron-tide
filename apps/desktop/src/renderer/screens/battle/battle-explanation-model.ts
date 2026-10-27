import type { ExplanationTree } from "@bluewave/events";

import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { formatNumber, formatPercent } from "../../lib/presentation-format/index.js";
import { translate } from "../../lib/strings.js";

export interface BattleExplanationRow {
  readonly key: string;
  readonly label: string;
  readonly valueText: string;
}

export interface BattleExplanationModel {
  readonly summary: string;
  readonly rows: readonly BattleExplanationRow[];
}

function formatTreeValue(
  value: number,
  unit: string | undefined,
  locale: FormattingLocale,
): string {
  if (unit === "bp") return formatPercent(value, { locale, maximumFractionDigits: 1 });
  return formatNumber(value, { locale });
}

export function battleExplanationModel(
  tree: ExplanationTree,
  summaryKey: string,
  locale: FormattingLocale,
): BattleExplanationModel {
  const rows = (tree.children ?? []).map((child): BattleExplanationRow => {
    return {
      key: child.formulaId,
      label: translate(`battle.${child.formulaId}`),
      valueText: formatTreeValue(Number(child.result), child.unit ?? tree.unit, locale),
    };
  });
  return {
    summary: translate(summaryKey, {
      value: formatTreeValue(Number(tree.result), tree.unit, locale),
    }),
    rows,
  };
}
