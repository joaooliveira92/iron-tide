import { CircleAlert } from "lucide-react";

import { Badge } from "../../../../components/ui/badge.js";
import type { AllocationSegment } from "../../../status-strip-state.js";
import { rowById } from "../../rows.js";
import { PinnableCard, StripNoteCard } from "../../StripCard.js";
import { StripPanel } from "../../StripPanel.js";
import { FIELD_LABEL } from "../../strip-styles.js";
import { useStatusStripState } from "../../StatusStripContext.js";
import { AllocationBar } from "./AllocationBar.js";
import { BudgetAllocationProvider, useBudgetAllocationState } from "./BudgetAllocationContext.js";
import { AllocationLegend } from "./AllocationLegend.js";

function BudgetMonthRow() {
  const { model } = useStatusStripState();
  const { allocation } = useBudgetAllocationState();
  const appropriation = rowById(model.budget, "monthly-budget");
  return (
    <div data-row="monthly-budget" className="flex items-baseline justify-between gap-3">
      <span className={FIELD_LABEL}>{appropriation?.label ?? "Monthly appropriation"}</span>
      <span className="font-display text-lg leading-6 font-semibold tabular-nums">
        {allocation.appropriation}
      </span>
    </div>
  );
}

function CommittedRow() {
  const { model } = useStatusStripState();
  const { allocation } = useBudgetAllocationState();
  const committedRow = rowById(model.budget, "total-expenses");
  return (
    <PinnableCard
      trigger={<div />}
      variant="pressable"
      delay={200}
      triggerProps={{
        "data-row": "total-expenses",
        tabIndex: 0,
        "aria-label": `Committed expenses: ${allocation.committed.value}`,
      }}
      triggerClassName="flex cursor-help items-center justify-between gap-3 rounded-sm border-t border-border/60 px-1.5 pt-1.5 text-xs outline-none hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring"
      card={committedRow === undefined ? <></> : <StripNoteCard row={committedRow} />}
    >
      <span className="text-muted-foreground">{committedRow?.label ?? "Committed expenses"}</span>
      <span className="flex items-center gap-1.5">
        {allocation.overCommitted && (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/40 bg-destructive/10 px-1.5 py-0 text-xs font-semibold uppercase tracking-wide text-foreground"
          >
            <CircleAlert className="size-3 text-destructive" aria-hidden="true" />
            Over-committed
          </Badge>
        )}
        <span className="font-display text-sm font-semibold tabular-nums">
          {allocation.committed.value}
        </span>
        <span className="w-10 text-right tabular-nums text-muted-foreground">
          {allocation.committed.percent}
        </span>
      </span>
    </PinnableCard>
  );
}

export function BudgetPanel() {
  const { model } = useStatusStripState();
  const noteFor = (id: AllocationSegment["id"]): string => rowById(model.budget, id)?.note ?? "";
  return (
    <StripPanel name="Budget" aside="Monthly" className="@container">
      <BudgetAllocationProvider allocation={model.allocation} noteFor={noteFor}>
        <div className="space-y-1.5">
          <BudgetMonthRow />
          <AllocationBar />
          <AllocationLegend />
          <CommittedRow />
        </div>
      </BudgetAllocationProvider>
    </StripPanel>
  );
}
