import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { formatConjunctionList } from "../../../lib/presentation-format/index.js";
import { cn } from "../../../lib/utils.js";
import type { ResearchFieldView, ResearchTotals } from "../research-view-model.js";
import { fieldIcon } from "./field-icons.js";
import { FieldSummary } from "./FieldSummary.js";

export interface AllocationSpectrumProps {
  readonly fields: readonly ResearchFieldView[];
  readonly totals: ResearchTotals;
  readonly budget: number;
  readonly selectedFieldId: string;
  readonly onSelect: (fieldId: string) => void;
}

const SEGMENT_TONE: Readonly<Record<string, string>> = {
  High: "bg-primary text-primary-foreground",
  Medium: "bg-primary/70 text-primary-foreground",
  Low: "bg-primary/45 text-foreground",
};

export function AllocationSpectrum({
  fields,
  totals,
  budget,
  selectedFieldId,
  onSelect,
}: AllocationSpectrumProps) {
  const funded = fields.filter((f) => f.projectedPoints > 0);
  const stalledHigh = fields.filter((f) => f.isHigh && f.state === "waiting");

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
        <span className="font-medium text-foreground">Allocation</span>
        <span className="text-muted-foreground tabular-nums">
          {totals.projectedPoints} pts · {funded.length} {funded.length === 1 ? "field" : "fields"}
        </span>
      </div>
      {funded.length === 0 ? (
        <div
          role="status"
          className="flex h-6 items-center rounded border border-dashed px-2 text-[0.6875rem] text-muted-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--border)_60%,transparent)_6px_7px)]"
        >
          {budget === 0
            ? "The research budget is empty, so nothing is spent."
            : "No field has an open technology, so the budget is not drawn."}
        </div>
      ) : (
        <div className="flex h-6 gap-px overflow-hidden rounded border bg-border">
          {funded.map((field) => {
            const Icon = fieldIcon(field.fieldId);
            return (
              <div
                key={field.fieldId}
                style={{ flexGrow: field.projectedPoints, flexBasis: 0 }}
                className="min-w-4 transition-[flex-grow] duration-500 motion-reduce:transition-none"
              >
                <HoverCard>
                  <HoverCardTrigger
                    delay={80}
                    closeDelay={60}
                    render={
                      <button
                        type="button"
                        onClick={() => onSelect(field.fieldId)}
                        aria-label={`${field.label}: ${field.projectedPoints} points, ${field.sharePct}% of the budget`}
                        className={cn(
                          "flex h-full w-full items-center gap-1 overflow-hidden px-1.5 text-[0.6875rem] outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          SEGMENT_TONE[field.weightLabel],
                          field.fieldId === selectedFieldId &&
                            "shadow-[inset_0_-2px_0_0_var(--foreground)]",
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate max-[40rem]:hidden">{field.label}</span>
                    <span className="ml-auto tabular-nums opacity-80 max-[30rem]:hidden">
                      {field.projectedPoints}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent side="bottom" align="center" className="w-64">
                    <FieldSummary field={field} />
                  </HoverCardContent>
                </HoverCard>
              </div>
            );
          })}
        </div>
      )}
      {stalledHigh.length > 0 && (
        <p role="status" className="text-[0.6875rem] text-amber-600 dark:text-amber-400">
          {formatConjunctionList(stalledHigh.map((f) => f.label))}{" "}
          {stalledHigh.length === 1 ? "is" : "are"} High priority with nothing open to research, so{" "}
          {stalledHigh.length === 1 ? "its" : "their"} share goes to other fields.
        </p>
      )}
    </div>
  );
}
