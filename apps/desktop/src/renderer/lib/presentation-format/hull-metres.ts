export function formatHullMetres(metres: number, decimals: 0 | 1): string {
  return metres.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
