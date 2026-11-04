import { cn } from "../../../../lib/utils.js";
import { percentString, SEGMENT_FILL } from "../../StripGlyph.js";
import { PinnableCard } from "../../StripCard.js";
import { BudgetLineCard } from "../../cards/BudgetLineCard.js";
import {
  useBudgetAllocationActions,
  useBudgetAllocationMeta,
  useBudgetAllocationState,
} from "./BudgetAllocationContext.js";

export function AllocationBar() {
  const { allocation, active } = useBudgetAllocationState();
  const { setActive } = useBudgetAllocationActions();
  const { noteFor, limit } = useBudgetAllocationMeta();
  return (
    <div className="relative">
      <div
        role="img"
        aria-label={`${allocation.committed.value} committed, ${allocation.committed.percent} of the monthly appropriation of ${allocation.appropriation}${allocation.overCommitted ? ", over-committed" : ""}`}
        className={cn(
          "slate-grid flex h-4 w-full gap-px overflow-hidden rounded-sm border border-border/70 bg-muted/60",
          allocation.overCommitted && "border-destructive/60",
        )}
      >
        {allocation.segments
          .filter((segment) => segment.fraction > 0)
          .map((segment) => (
            <PinnableCard
              key={segment.id}
              trigger={<span />}
              variant="pointer"
              delay={80}
              onActive={(open) => {
                setActive(open ? segment.id : null);
              }}
              triggerProps={{
                "data-segment": segment.id,
                "data-active": active === segment.id,
                style: { width: percentString(segment.fraction) },
              }}
              triggerClassName={cn(
                "h-full min-w-0.5 cursor-help transition-[opacity,filter] duration-150",
                SEGMENT_FILL[segment.id],
                active !== null && active !== segment.id && "opacity-30",
                active === segment.id && "brightness-125",
              )}
              card={
                <BudgetLineCard
                  segment={segment}
                  allocation={allocation}
                  note={noteFor(segment.id)}
                />
              }
            />
          ))}
      </div>
      {limit !== null && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 bg-foreground"
          style={{ left: percentString(limit) }}
        />
      )}
    </div>
  );
}
