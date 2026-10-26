import type { LedgerReconciliation } from "./ledger-reconciliation.js";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const REPORT_FORMULA_VERSION = "report_v1";

const SOURCE = {
  kind: "code",
  ref: "packages/campaign-engine/src/ledger-reconciliation.ts",
} as const;
const UNIT = "nc";

function lineChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, REPORT_FORMULA_VERSION)
    .withInput("amount", amount)
    .withResult(amount)
    .withUnit(UNIT)
    .withSource(SOURCE)
    .build();
}

export function explainReportTreasury(reconciliation: LedgerReconciliation): ExplanationTree {
  const builder = new ExplanationBuilder("report_treasury", REPORT_FORMULA_VERSION)
    .withInput("opening", reconciliation.opening)
    .withIntermediate("netChange", reconciliation.closing - reconciliation.opening)
    .withResult(reconciliation.closing)
    .withUnit(UNIT)
    .withOperation("add")
    .withSource(SOURCE)
    .addChild(lineChild("report_treasury.opening", reconciliation.opening));
  const inflows: readonly (readonly [string, number])[] = [
    ["report_treasury.revenue", reconciliation.revenue],
  ];
  const outflows: readonly (readonly [string, number])[] = [
    ["report_treasury.construction", -reconciliation.construction],
    ["report_treasury.preservation", -reconciliation.preservation],
    ["report_treasury.maintenance", -reconciliation.maintenance],
    ["report_treasury.obligation", -reconciliation.obligation],
    ["report_treasury.research", -reconciliation.research],
    ["report_treasury.other", reconciliation.other],
  ];
  for (const [formulaId, amount] of [...inflows, ...outflows]) {
    if (amount !== 0) {
      builder.addChild(lineChild(formulaId, amount));
    }
  }
  return builder.build();
}
