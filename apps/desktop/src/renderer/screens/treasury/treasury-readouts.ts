import type { ExplanationTree } from "@bluewave/events";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { TreasuryBreakdown } from "./treasury-summary.js";

export type ReadoutTone = "neutral" | "good" | "warn" | "bad";

export interface ReadoutRow {
  readonly label: string;
  readonly value: string;
}

export interface TreasuryReadout {
  readonly id: "funds" | "monthEnd" | "net" | "runway";
  readonly label: string;
  readonly value: string;
  readonly tone: ReadoutTone;
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
  readonly note?: string;
  readonly explanation?: ExplanationTree;
}

export function netTone(net: number): ReadoutTone {
  if (net < 0) return "bad";
  return net === 0 ? "warn" : "good";
}

export function signed(value: number, format: PresentationFormat): string {
  return value > 0 ? `+${format.count(value)}` : format.count(value);
}

export function treasuryReadouts(
  breakdown: TreasuryBreakdown,
  format: PresentationFormat,
  carryingCost = 0,
): readonly TreasuryReadout[] {
  const net = breakdown.projectedSurplusDeficit;
  const readouts: TreasuryReadout[] = [
    {
      id: "funds",
      label: "Available funds",
      value: format.count(breakdown.availableFunds),
      tone: "neutral",
      title: "What the navy holds today",
      rows: [
        { label: "Available funds", value: format.count(breakdown.availableFunds) },
        { label: "Appropriation this month", value: format.count(breakdown.income) },
        { label: "Committed expenditure", value: format.count(breakdown.totalExpenditure) },
      ],
      ...(breakdown.appropriationExplanation === undefined
        ? {}
        : { explanation: breakdown.appropriationExplanation }),
    },
    {
      id: "net",
      label: "Net before construction",
      value: signed(net, format),
      tone: netTone(net),
      title: "Appropriation less committed expenditure",
      rows: [
        { label: "Appropriation", value: format.count(breakdown.income) },
        { label: "Obligations", value: format.count(-breakdown.obligations) },
        { label: "Fleet maintenance", value: format.count(-breakdown.fleetMaintenance) },
        { label: "Research", value: format.count(-breakdown.researchSpend) },
        { label: "Projected net", value: signed(net, format) },
      ],
      note: "Construction is charged when a ship is ordered, so it is not in this figure.",
      ...(breakdown.netExplanation === undefined ? {} : { explanation: breakdown.netExplanation }),
    },
    {
      id: "monthEnd",
      label: "Month-end funds",
      value: format.count(breakdown.projectedMonthEndFunds),
      tone: breakdown.projectedMonthEndFunds < breakdown.availableFunds ? "warn" : "neutral",
      title: "Where the treasury lands after this month",
      rows: [
        { label: "Available funds", value: format.count(breakdown.availableFunds) },
        ...(carryingCost > 0
          ? [{ label: "Halted-project carrying cost", value: format.count(-carryingCost) }]
          : []),
        {
          label: "Planned construction (up to)",
          value: format.count(-breakdown.plannedConstruction),
        },
        {
          label: "Projected month-end funds",
          value: format.count(breakdown.projectedMonthEndFunds),
        },
      ],
      ...(breakdown.monthEndExplanation === undefined
        ? {}
        : { explanation: breakdown.monthEndExplanation }),
    },
  ];
  if (breakdown.runwayMonths !== undefined) {
    readouts.push({
      id: "runway",
      label: "Runway",
      value: `${format.count(breakdown.runwayMonths)} ${breakdown.runwayMonths === 1 ? "month" : "months"}`,
      tone: breakdown.runwayMonths <= 3 ? "bad" : "warn",
      title: "How long the treasury lasts at this rate",
      rows: [
        { label: "Available funds", value: format.count(breakdown.availableFunds) },
        { label: "Monthly net", value: signed(net, format) },
      ],
      ...(breakdown.runwayExplanation === undefined
        ? {}
        : { explanation: breakdown.runwayExplanation }),
    });
  }
  return readouts;
}
