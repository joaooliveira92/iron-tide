import { formatNumber } from "./format.js";

export function shaftHorsepower(kw: number, kwPerShpBp: number): number {
  if (!Number.isSafeInteger(kwPerShpBp) || kwPerShpBp <= 0)
    throw new Error(`kwPerShpBp must be a positive integer, got ${kwPerShpBp}`);
  return Math.round((kw * 10_000) / kwPerShpBp);
}

export function formatPowerBoth(kw: number, kwPerShpBp: number): string {
  const n = (v: number) => formatNumber(v, { locale: "en-US", numberScale: "full" });
  return `${n(kw)} kW (${n(shaftHorsepower(kw, kwPerShpBp))} hp)`;
}
