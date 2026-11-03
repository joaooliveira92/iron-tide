import type { CampaignReads } from "./campaign-reads.js";
import { BalanceChip, TreasuryChip, useStatusStripReads } from "./StatusStrip.js";

export function BudgetContextChips({ reads }: { readonly reads: CampaignReads }) {
  const { model, trend } = useStatusStripReads(reads);
  if (model === null) return null;
  return (
    <div role="group" aria-label="Budget" className="flex flex-wrap items-center gap-1.5">
      <BalanceChip model={model} trend={trend} />
      <TreasuryChip model={model} trend={trend} />
    </div>
  );
}
