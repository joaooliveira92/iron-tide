const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function monthLabel(
  current: { readonly month: number; readonly year: number },
  offsetMonths: number,
): string {
  const index = current.year * 12 + (current.month - 1) + offsetMonths;
  const year = Math.floor(index / 12);
  return `${MONTH_NAMES[index - year * 12]} ${year}`;
}

export function monthsPhrase(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}
