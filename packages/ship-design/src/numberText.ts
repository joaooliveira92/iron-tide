export function groupedInteger(value: number): string {
  const n = Math.trunc(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}`;
}
