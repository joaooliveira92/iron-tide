/** "12.5": a hull dimension in metres at a fixed number of decimals. The caller adds the unit. Display only: never stored or hashed. */
export function formatHullMetres(metres: number, decimals: 0 | 1): string {
  return metres.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
