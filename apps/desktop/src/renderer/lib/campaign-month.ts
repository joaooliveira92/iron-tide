export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT = [
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

export type MonthNameStyle = "long" | "short";

export function monthName(month: number, style: MonthNameStyle = "long"): string | undefined {
  const names: readonly string[] = style === "short" ? MONTH_NAMES_SHORT : MONTH_NAMES;
  return names[month - 1];
}

export function formatMonthYear(
  month: { readonly year: number; readonly month: number },
  style: MonthNameStyle = "long",
): string {
  const name = monthName(month.month, style);
  return `${name ?? month.month} ${month.year}`;
}
