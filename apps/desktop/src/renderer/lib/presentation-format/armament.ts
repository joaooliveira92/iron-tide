import { UM_PER_INCH } from "@bluewave/contracts";

const grouped = (value: number, maximumFractionDigits: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits });

/** "12.0-inch": a gun calibre in inches, to one decimal. Display only: never stored or hashed. */
export function formatCalibreInches(caliberUm: number): string {
  return `${(caliberUm / UM_PER_INCH).toFixed(1)}-inch`;
}

/** "1,234.5": a mass in kg as tonnes, to one decimal at most. The caller adds the unit. */
export function formatTonnes(kg: number): string {
  return grouped(kg / 1000, 1);
}

/** "£1,234": a cost in micro-pounds as whole pounds. Display only: never stored or hashed. */
export function formatPoundsFromMicro(costMicro: number): string {
  return `£${grouped(Math.round(costMicro / 1_000_000), 0)}`;
}
