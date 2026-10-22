import type { Kg } from "./units.js";
import { kg } from "./units.js";

export const LEDGER_CATEGORIES = [
  "hull",
  "machinery",
  "fuel",
  "armour",
  "armament",
  "ammunition",
  "sensors",
  "mission",
  "crew",
  "auxiliary",
  "margin",
  "reserve",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];
export type DisplacementLedger = Readonly<Record<LedgerCategory, Kg>>;

export function emptyLedger(): DisplacementLedger {
  return Object.fromEntries(LEDGER_CATEGORIES.map((c) => [c, kg(0)])) as DisplacementLedger;
}

export function ledgerTotal(ledger: DisplacementLedger): Kg {
  let sum = 0;
  for (const c of LEDGER_CATEGORIES) sum += ledger[c];
  return kg(sum);
}

export function withLine(
  ledger: DisplacementLedger,
  category: LedgerCategory,
  mass: Kg,
): DisplacementLedger {
  return { ...ledger, [category]: mass };
}
