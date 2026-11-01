import { cachedListFormat } from "./intl-cache.js";

const CONJUNCTION_OPTIONS: Intl.ListFormatOptions = { style: "long", type: "conjunction" };

export function formatConjunctionList(items: readonly string[], locale = "en"): string {
  return cachedListFormat(locale, CONJUNCTION_OPTIONS).format(items);
}
