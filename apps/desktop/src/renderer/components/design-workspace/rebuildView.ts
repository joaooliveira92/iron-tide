import type { RebuildBalance } from "@bluewave/ship-design";
import type { RebuildMeasuresView } from "../../../shared/design-contract.js";

export type LimitId = "displacement" | "speed" | "length" | "beam";

export interface LimitRow {
  readonly id: LimitId;
  readonly label: string;
  /** The change this design makes, signed, e.g. "+12.5 %" or "-1.0 kn". */
  readonly change: string;
  /** What a rebuild may do, e.g. "up to +20.0 %" or "within ±5.0 %". */
  readonly limit: string;
  /** True when the change is beyond the limit (the rebuild would be refused). */
  readonly over: boolean;
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "");
const percent = (bp: number) => `${sign(bp)}${(Math.abs(bp) / 100).toFixed(1)} %`;
const plainPercent = (bp: number) => `${(bp / 100).toFixed(1)} %`;
const knots = (milli: number) => `${sign(milli)}${(Math.abs(milli) / 1000).toFixed(1)} kn`;

/**
 * Each retained-hull limit beside the change the design makes against it (DESIGN-23 section 21). Pure: every number is the
 * check's own measure and the ruleset's own limit; nothing is recomputed here except the comparison that colours the row.
 */
export function limitRows(measures: RebuildMeasuresView, balance: RebuildBalance): LimitRow[] {
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
      limit: `up to +${(balance.maxSpeedIncreaseMilliKnots / 1000).toFixed(1)} kn`,
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
