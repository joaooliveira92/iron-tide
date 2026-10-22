import type { BowStyle, SternStyle } from "./hull-character.js";

export interface HullLines {
  readonly waterplaneCoeffBp: number;
  readonly lcbPermille: number;
  readonly bow?: BowStyle;
  readonly stern?: SternStyle;
}

const STERN_HALF: Record<SternStyle, number> = { counter: 0.22, round: 0.1, transom: 0.34 };

const BOW_TIP: Record<BowStyle, number> = { ram: 0, spoon: 0.1, plumb: 0.2 };

const BOW_EXP = 1.6;
const STERN_EXP = 2;

function areaFraction(entrance: number, run: number, tip: number, transom: number): number {
  const fore = entrance * (tip + ((1 - tip) * BOW_EXP) / (BOW_EXP + 1));
  const aft = run * (transom + ((1 - transom) * STERN_EXP) / (STERN_EXP + 1));
  return fore + aft + (1 - entrance - run);
}

export function waterplaneShape(lines?: HullLines): (t: number) => number {
  const cw = Math.min(0.95, Math.max(0.5, (lines?.waterplaneCoeffBp ?? 7200) / 10000));
  const lcbShift = ((lines?.lcbPermille ?? 500) - 500) / 1000;
  const tip = BOW_TIP[lines?.bow ?? "ram"];
  const transom = STERN_HALF[lines?.stern ?? "counter"];
  const e0 = Math.min(1.2, Math.max(0.7, 1 + lcbShift * 2));
  const r0 = Math.min(1.2, Math.max(0.7, 1 - lcbShift * 2));
  let lo = 0.1;
  let hi = 1 / (e0 + r0);
  for (let i = 0; i < 40; i++) {
    const k = (lo + hi) / 2;
    if (areaFraction(k * e0, k * r0, tip, transom) > cw) lo = k;
    else hi = k;
  }
  const k = (lo + hi) / 2;
  const entrance = k * e0;
  const run = k * r0;
  return (t) => {
    const f = Math.min(1, Math.max(0, t));
    if (f < entrance) return tip + (1 - tip) * (1 - ((entrance - f) / entrance) ** BOW_EXP);
    if (f > 1 - run) {
      const u = (f - (1 - run)) / run;
      return transom + (1 - transom) * (1 - u ** STERN_EXP);
    }
    return 1;
  };
}
