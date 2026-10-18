import { formatNumber } from "./format.js";

/**
 * Shaft horsepower for a power in kW, from the ruleset's kW-per-shp constant (`kwPerShpBp`, bp of a kW per shp: the
 * same figure the power model uses, so the two readouts always agree). Display only: never stored or hashed.
 */
export function shaftHorsepower(kw: number, kwPerShpBp: number): number {
  if (!Number.isSafeInteger(kwPerShpBp) || kwPerShpBp <= 0)
    throw new Error(`kwPerShpBp must be a positive integer, got ${kwPerShpBp}`);
  return Math.round((kw * 10_000) / kwPerShpBp);
}

/** "3,300 kW (4,425 hp)": kW first, horsepower beside it, so a reader can take either. */
export function formatPowerBoth(kw: number, kwPerShpBp: number): string {
  const n = (v: number) => formatNumber(v, { locale: "en-US", numberScale: "full" });
  return `${n(kw)} kW (${n(shaftHorsepower(kw, kwPerShpBp))} hp)`;
}
