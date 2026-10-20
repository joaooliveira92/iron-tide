/** Joins display strings as a locale-aware conjunction ("A, B and C"). */
export function formatConjunctionList(items: readonly string[], locale = "en"): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
}
