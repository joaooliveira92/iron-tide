import type { ReferenceDesign } from "./content.js";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function selectInitialReference(
  references: readonly ReferenceDesign[],
  fixedMonth: string | null,
): ReferenceDesign | undefined {
  if (references.length === 0) return undefined;
  if (fixedMonth === null || !MONTH.test(fixedMonth)) return references[0];
  const available = references.filter((r) => r.month <= fixedMonth);
  if (available.length === 0) return references[0];
  return [...available].sort((a, b) => b.month.localeCompare(a.month))[0];
}
