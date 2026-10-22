import { formatCount, type PresentationFormat } from "../../lib/presentation-format/index.js";

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
