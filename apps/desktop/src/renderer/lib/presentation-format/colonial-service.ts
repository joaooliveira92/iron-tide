/** "8.5": a colonial-service fitting's displacement in tonnes at one decimal. The caller adds the unit. Display only: never stored or hashed. */
export function formatFittingTonnes(kg: number): string {
  return (kg / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** "1.37": a basis-point share as a percentage at two decimals. The caller adds the sign. Display only: never stored or hashed. */
export function formatFittingShare(bp: number): string {
  return (bp / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
