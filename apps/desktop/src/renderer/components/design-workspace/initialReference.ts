import type { ReferenceDesign } from "./content.js";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The starting design the board opens on. In a campaign it is the newest reference design that exists at the
 * campaign date; file order breaks equal-date ties, so the choice is stable when several designs share a month.
 * A design dated after the campaign date is never chosen. When the catalogue is empty this is `undefined`; when
 * the date is missing, malformed, or before every design, the first design is the defined fallback (never a
 * silent reach into the future).
 */
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
