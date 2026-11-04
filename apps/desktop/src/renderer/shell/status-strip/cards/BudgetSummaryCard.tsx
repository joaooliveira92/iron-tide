import { Scale } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import type { BudgetAllocation } from "../../status-strip-state.js";
import { CardFoot, CardHeader, SEGMENT_FILL, StripGlyph } from "../StripGlyph.js";

export function BudgetSummaryCard({ allocation }: { readonly allocation: BudgetAllocation }) {
  return (
    <>
      <CardHeader
        title="Budget"
        icon={<Scale className="size-3.5" />}
        tone={allocation.overCommitted ? "alert" : "normal"}
        aside={
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {allocation.committed.value} of {allocation.appropriation}
          </span>
        }
      />
      <div className="space-y-2 px-3 py-3">
        <StripGlyph variant="stack" segments={allocation.segments} className="h-2.5" />
        <ul className="space-y-1">
          {allocation.segments.map((segment) => (
            <li key={segment.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-sm", SEGMENT_FILL[segment.id])}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums">{segment.value}</span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">
                {segment.percent}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <CardFoot>
        {allocation.overCommitted
          ? "Over-committed: the committed lines exceed the monthly appropriation."
          : "Committed lines against the monthly appropriation. Open the full strip for each line."}
      </CardFoot>
    </>
  );
}
