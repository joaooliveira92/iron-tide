export interface LedgerReconciliationInput {
  readonly categoryId: string;
  readonly debit: number;
  readonly credit: number;
}

export interface LedgerReconciliation {
  readonly opening: number;
  readonly revenue: number;
  readonly construction: number;
  readonly preservation: number;
  readonly maintenance: number;
  readonly obligation: number;
  readonly research: number;
  readonly other: number;
  readonly closing: number;
}

const CONSTRUCTION_CATEGORIES = new Set(["APPROPRIATION", "CONSTRUCTION_BUDGET"]);

export function reconcileMonthLedger(
  entries: readonly LedgerReconciliationInput[],
  opening: number,
  closing: number,
): LedgerReconciliation {
  let revenue = 0;
  let construction = 0;
  let preservation = 0;
  let maintenance = 0;
  let obligation = 0;
  let research = 0;
  for (const entry of entries) {
    if (entry.categoryId === "NAVAL_APPROPRIATION") revenue += entry.credit;
    else if (CONSTRUCTION_CATEGORIES.has(entry.categoryId)) construction += entry.debit;
    else if (entry.categoryId === "CONSTRUCTION_PRESERVATION") preservation += entry.debit;
    else if (entry.categoryId === "MAINTENANCE_EXPENDITURE") maintenance += entry.debit;
    else if (entry.categoryId === "OBLIGATION") obligation += entry.debit;
    else if (entry.categoryId === "RESEARCH_EXPENDITURE") research += entry.debit;
  }
  const named = revenue - construction - preservation - maintenance - obligation - research;
  return {
    opening,
    revenue,
    construction,
    preservation,
    maintenance,
    obligation,
    research,
    other: closing - opening - named,
    closing,
  };
}
