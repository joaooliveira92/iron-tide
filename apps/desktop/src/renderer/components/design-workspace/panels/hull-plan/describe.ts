import { formatFixed } from "../../../../lib/presentation-format/format.js";
import type { BowStyle, SternStyle } from "./geometry.js";

export interface DrawingFacts {
  readonly hullFormId: string | undefined;
  readonly lengthM: number;
  readonly beamM: number;
  readonly depthM: number;
  readonly draughtM: number;
  readonly bow: BowStyle;
  readonly stern: SternStyle;
  readonly fittings: number;
  readonly funnels: number;
  readonly superstructure:
    | { readonly startPermille: number; readonly endPermille: number }
    | undefined;
}

const BOW_LABEL: Record<BowStyle, string> = {
  ram: "ram bow",
  spoon: "spoon bow",
  plumb: "plumb bow",
};
const STERN_LABEL: Record<SternStyle, string> = {
  counter: "counter stern",
  transom: "transom stern",
  round: "rounded stern",
};

const SCHEMATIC = "schematic view, not a lines plan";

const formLabel = (id: string | undefined) => (id ? id.replaceAll("_", " ") : "unknown hull form");

const funnelLabel = (n: number) => (n === 0 ? "no funnels" : n === 1 ? "1 funnel" : `${n} funnels`);

const houseLabel = (s: DrawingFacts["superstructure"]) =>
  s
    ? `superstructure from ${Math.round(s.startPermille / 10)}% to ${Math.round(s.endPermille / 10)}% of length`
    : "no superstructure zone";

const dims = (m: number, digits: number) =>
  Number.isFinite(m) ? formatFixed(m, { locale: "en-US", digits }) : "unknown";

export function planLabel(f: DrawingFacts): string {
  return `Top-down plan, ${dims(f.lengthM, 0)} m by ${dims(f.beamM, 1)} m, ${formLabel(f.hullFormId)}, ${BOW_LABEL[f.bow]}, ${STERN_LABEL[f.stern]}, ${f.fittings} fittings placed, ${funnelLabel(f.funnels)}, ${houseLabel(f.superstructure)}; ${SCHEMATIC}`;
}

export function profileLabel(f: DrawingFacts): string {
  return `Side profile, depth ${dims(f.depthM, 1)} m, draught ${dims(f.draughtM, 1)} m, ${formLabel(f.hullFormId)}, ${BOW_LABEL[f.bow]}, ${STERN_LABEL[f.stern]}, ${funnelLabel(f.funnels)}, ${houseLabel(f.superstructure)}; ${SCHEMATIC}`;
}
