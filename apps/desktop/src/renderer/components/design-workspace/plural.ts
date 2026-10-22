import { formatCount, type PresentationFormat } from "../../lib/presentation-format/index.js";

/**
 * "1 edit", "2 edits"; `none` replaces the zero case ("No edits"). English only: the UI is English, so the count
 * groups through the presentation seam with the default locale when no bound format is passed. Callers with a
 * `PresentationFormat` (ADR-0218) pass it last to group under the player's formatting locale.
 */
export function plural(
  n: number,
  one: string,
  many = `${one}s`,
  none?: string,
  format?: PresentationFormat,
): string {
  if (n === 0 && none !== undefined) return none;
  return `${format === undefined ? formatCount(n) : format.count(n)} ${n === 1 ? one : many}`;
}
