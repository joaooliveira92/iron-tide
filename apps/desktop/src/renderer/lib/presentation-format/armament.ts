import { UM_PER_INCH } from "@bluewave/contracts";

const grouped = (value: number, maximumFractionDigits: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits });

export function formatCalibreInches(caliberUm: number): string {
  return `${(caliberUm / UM_PER_INCH).toFixed(1)}-inch`;
}

export function formatTonnes(kg: number): string {
  return grouped(kg / 1000, 1);
}
