import type { RebuildBalance } from "@bluewave/ship-design";
import type { RebuildMeasuresView } from "../../../shared/design-contract.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";

export type LimitId = "displacement" | "speed" | "length" | "beam";

export interface LimitRow {
  readonly id: LimitId;
  readonly label: string;
  readonly change: string;
  readonly limit: string;
  readonly over: boolean;
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "");

export function limitRows(
  measures: RebuildMeasuresView,
  balance: RebuildBalance,
  format: PresentationFormat,
): LimitRow[] {
  const percent = (bp: number) => `${sign(bp)}${format.percent(Math.abs(bp), 1)}`;
  const plainPercent = (bp: number) => format.percent(bp, 1);
  const knots = (milli: number) =>
    `${sign(milli)}${format.number(Math.abs(milli) / 1000, { maximumFractionDigits: 1 })} kn`;
  return [
    {
      id: "displacement",
      label: "Displacement",
      change: percent(measures.displacementChangeBp),
      limit: `up to +${plainPercent(balance.maxDisplacementIncreaseBp)}`,
      over: measures.displacementChangeBp > balance.maxDisplacementIncreaseBp,
    },
    {
      id: "speed",
      label: "Speed",
      change: knots(measures.speedChangeMilliKnots),
      limit: `up to +${format.number(balance.maxSpeedIncreaseMilliKnots / 1000, { maximumFractionDigits: 1 })} kn`,
      over: measures.speedChangeMilliKnots > balance.maxSpeedIncreaseMilliKnots,
    },
    {
      id: "length",
      label: "Length",
      change: percent(measures.lengthChangeBp),
      limit: `within ±${plainPercent(balance.maxLengthChangeBp)}`,
      over: Math.abs(measures.lengthChangeBp) > balance.maxLengthChangeBp,
    },
    {
      id: "beam",
      label: "Beam",
      change: percent(measures.beamChangeBp),
      limit: `within ±${plainPercent(balance.maxBeamChangeBp)}`,
      over: Math.abs(measures.beamChangeBp) > balance.maxBeamChangeBp,
    },
  ];
}
