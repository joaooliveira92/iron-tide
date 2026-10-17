/**
 * Deterministic integer text for the design explanation strings (U-3 map D6,
 * ADR-0218). `toLocaleString` is locale-dependent — a string built with it can
 * differ across OSes/locales — so the domain must not use it. This helper renders
 * the same grouped form without `Intl` or a locale, so explanation text is stable.
 *
 * The remaining presentation-text ownership (the string templates themselves) is
 * the owner-reviewed structured-explanation migration; see the ratchet test.
 */
export function groupedInteger(value: number): string {
  const n = Math.trunc(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}`;
}
