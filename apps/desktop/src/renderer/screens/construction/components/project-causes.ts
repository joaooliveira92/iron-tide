import type { ConstructionProjectReadoutView } from "@bluewave/campaign-engine";
import { resolveMessage } from "../../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { causeWords, durationText } from "../cause-text.js";
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
    const cause = causeWords(entry.reasonCode, entry.kind);
    const text =
      entry.kind === "delay"
        ? resolveMessage("construction.cause.line.delay", {
            when,
            cause,
            duration: durationText(entry.amount),
          })
        : resolveMessage("construction.cause.line.overrun", {
            when,
            cause,
            cost: format.money(entry.amount),
          });
    return { key: `${entry.kind}:${entry.month}:${String(index)}`, text };
  });
}
