import type { StripRow } from "../status-strip-state.js";

const DESCRIPTIONS: Record<string, string> = {
  treasury: "Cash on hand at the start of the month.",
  maintenance: "Fleet upkeep charged every month.",
  research: "Monthly research spending.",
  balance:
    "Projected monthly appropriation minus total expenses. A negative figure is a deficit, shown in words as well as colour.",
};

export function descriptionFor(row: StripRow): string {
  return row.note !== "" ? row.note : (DESCRIPTIONS[row.id] ?? "");
}
