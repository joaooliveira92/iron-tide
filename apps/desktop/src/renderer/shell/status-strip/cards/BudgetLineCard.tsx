import { cn } from "../../../lib/utils.js";
import type { AllocationSegment, BudgetAllocation } from "../../status-strip-state.js";
import {
  CardFoot,
  CardHeader,
  SEGMENT_FILL,
  SEGMENT_TEXT,
  Stat,
  StripGlyph,
} from "../StripGlyph.js";

const LINE_MEANING: Record<AllocationSegment["id"], string> = {
  obligations: "Fixed monthly commitments that are charged before anything else.",
  maintenance: "Fleet upkeep, charged every month and higher in wartime.",
  research: "The standing research budget the engine will actually pay next month.",
  construction:
    "An upper bound on shipbuilding: what the yards can absorb, before the treasury limits it. Not part of committed expenses.",
};

export function BudgetLineCard({
  segment,
  allocation,
  note,
}: {
  readonly segment: AllocationSegment;
  readonly allocation: BudgetAllocation;
  readonly note: string;
}) {
  const planned = segment.kind === "planned";
  return (
    <>
      <CardHeader
        title={segment.label}
        icon={<span className={cn("size-2.5 rounded-sm", SEGMENT_FILL[segment.id])} />}
        aside={
          <span className="rounded-sm border border-border/70 px-1.5 text-xs font-medium text-muted-foreground">
            {planned ? "Upper bound" : "Committed"}
          </span>
        }
      />
      <div className="flex items-center gap-3 px-3 py-3">
        <StripGlyph variant="ring" fraction={segment.fraction} tone={SEGMENT_TEXT[segment.id]}>
          {segment.percent}
        </StripGlyph>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-xl leading-6 font-semibold tabular-nums">
            {segment.value}
            <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">
              per month
            </span>
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            of the {allocation.appropriation} appropriation
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-1.5 px-3 pb-3">
        <Stat label="Over a year" value={segment.yearly} />
        <Stat
          label={planned ? "In committed total" : "Of committed total"}
          value={planned ? "Not included" : segment.shareOfCommitted}
        />
      </dl>
      <CardFoot>
        {note === "" ? LINE_MEANING[segment.id] : `${LINE_MEANING[segment.id]} ${note}`}
      </CardFoot>
    </>
  );
}
