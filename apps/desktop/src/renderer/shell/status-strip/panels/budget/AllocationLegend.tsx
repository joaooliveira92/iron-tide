import { cn } from "../../../../lib/utils.js";
import { BudgetLineCard } from "../../cards/BudgetLineCard.js";
import { PinnableCard } from "../../StripCard.js";
import { SEGMENT_FILL } from "../../StripGlyph.js";
import {
  useBudgetAllocationActions,
  useBudgetAllocationMeta,
  useBudgetAllocationState,
} from "./BudgetAllocationContext.js";

export function AllocationLegend() {
  const { allocation, active } = useBudgetAllocationState();
  const { activate, clear, setActive } = useBudgetAllocationActions();
  const { noteFor } = useBudgetAllocationMeta();
  return (
    <div className="grid gap-x-3 @sm:grid-cols-2">
      {allocation.segments.map((segment) => (
        <div
          key={segment.id}
          onMouseEnter={() => {
            activate(segment.id);
          }}
          onMouseLeave={clear}
        >
          <PinnableCard
            trigger={<div />}
            variant="pressable"
            delay={200}
            onActive={(open) => {
              setActive(open ? segment.id : null);
            }}
            triggerProps={{
              "data-row": segment.id,
              "data-active": active === segment.id,
              tabIndex: 0,
              "aria-label": `${segment.label}: ${segment.value}, ${segment.percent}`,
            }}
            triggerClassName={cn(
              "grid cursor-help grid-cols-[auto_minmax(0,1fr)_auto_2.5rem] items-center gap-x-2 rounded-sm px-1.5 py-0.5 text-xs outline-none transition-[opacity,background-color] hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring data-[pinned=true]:bg-muted/60",
              active !== null && active !== segment.id && "opacity-50",
            )}
            card={
              <BudgetLineCard
                segment={segment}
                allocation={allocation}
                note={noteFor(segment.id)}
              />
            }
          >
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-[2px]", SEGMENT_FILL[segment.id])}
            />
            <span className="min-w-0 break-words text-muted-foreground">{segment.label}</span>
            <span className="font-medium tabular-nums">{segment.value}</span>
            <span className="text-right tabular-nums text-muted-foreground">{segment.percent}</span>
          </PinnableCard>
        </div>
      ))}
    </div>
  );
}
