import { Scale } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import type { StatusStripModel } from "../../status-strip-state.js";
import { BudgetSummaryCard } from "../cards/BudgetSummaryCard.js";
import { PinnableCard } from "../StripCard.js";
import { StripGlyph } from "../StripGlyph.js";
import { CHIP } from "../strip-styles.js";

export function BudgetChip({ model }: { readonly model: StatusStripModel }) {
  const { allocation } = model;
  return (
    <PinnableCard
      trigger={<button type="button" />}
      variant="button"
      width="w-80"
      triggerProps={{
        "aria-label": `Budget: ${allocation.committed.value} committed, ${allocation.committed.percent} of ${allocation.appropriation}`,
      }}
      triggerClassName={cn(
        CHIP,
        "cursor-help",
        allocation.overCommitted && "border-destructive/40 bg-destructive/10",
      )}
      card={<BudgetSummaryCard allocation={allocation} />}
    >
      <Scale className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <StripGlyph variant="stack" segments={allocation.segments} className="h-2 w-20" />
      <span className="tabular-nums font-semibold">{allocation.committed.percent}</span>
    </PinnableCard>
  );
}
