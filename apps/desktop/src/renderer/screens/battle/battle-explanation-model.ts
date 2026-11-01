import type { ExplanationTree } from "@bluewave/events";

import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { formatNumber, formatPercent } from "../../lib/presentation-format/format.js";
import { translate } from "../../lib/strings.js";

const MILLI_KNOTS_PER_KNOT = 1_000;

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
  if (unit === "mkn") {
    return `${formatNumber(value / MILLI_KNOTS_PER_KNOT, { locale, maximumFractionDigits: 1 })} kn`;
  }
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
