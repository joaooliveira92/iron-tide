import type { ConstructionProjectReadoutView } from "@bluewave/campaign-engine";
import { constructionEventCause } from "../../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { formatMonthKey } from "../month-key.js";

export interface CauseLine {
  readonly key: string;
  readonly text: string;
}

interface CauseEntry {
  readonly month: string;
  readonly kind: "delay" | "overrun";
  readonly reasonCode: string;
  readonly amount: number;
}

const KIND_ORDER = { delay: 0, overrun: 1 } as const;

function monthsText(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

function causeWords(entry: CauseEntry): string {
  if (entry.reasonCode === "PAYMENT_DEFAULT_DELAYED") return "a payment default";
  const authored = constructionEventCause(entry.reasonCode);
  if (authored !== undefined) return authored;
  return entry.kind === "delay" ? "a delay" : "a cost overrun";
}

function compareNewestFirst(a: CauseEntry, b: CauseEntry): number {
  if (a.month !== b.month) return a.month < b.month ? 1 : -1;
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

export function causeLines(
  readout: ConstructionProjectReadoutView,
  format: PresentationFormat,
): readonly CauseLine[] {
  const entries: readonly CauseEntry[] = [
    ...(readout.delays ?? []).map((d): CauseEntry => ({
      month: d.month,
      kind: "delay",
      reasonCode: d.reasonCode,
      amount: d.months,
    })),
    ...(readout.overruns ?? []).map((o): CauseEntry => ({
      month: o.month,
      kind: "overrun",
      reasonCode: o.reasonCode,
      amount: o.costUnits,
    })),
  ].sort(compareNewestFirst);
  return entries.map((entry, index) => {
    const when = formatMonthKey(format, entry.month);
    const text =
      entry.kind === "delay"
        ? `${when}: ${causeWords(entry)} delayed the build by ${monthsText(entry.amount)}`
        : `${when}: ${causeWords(entry)} added ${format.money(entry.amount)} to the cost`;
    return { key: `${entry.kind}:${entry.month}:${String(index)}`, text };
  });
}
