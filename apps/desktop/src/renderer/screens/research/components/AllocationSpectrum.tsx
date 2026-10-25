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
    <section aria-label="Monthly allocation" className="space-y-1.5 border-b px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <h3 className="font-medium text-foreground">Where the budget goes</h3>
        <span className="text-muted-foreground tabular-nums">
          {totals.projectedPoints} pts per month across {funded.length}{" "}
          {funded.length === 1 ? "field" : "fields"}
        </span>
      </div>
      {funded.length === 0 ? (
        <div
          role="status"
          className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--border)_60%,transparent)_6px_7px)]"
        >
          {budget === 0
            ? "The research budget is empty, so nothing is spent."
            : "No field has an open technology, so the budget is not drawn."}
        </div>
      ) : (
        <ul className="flex h-9 gap-px overflow-hidden rounded-md border bg-border">
          {funded.map((field) => {
            const Icon = fieldIcon(field.fieldId);
            return (
              <li
                key={field.fieldId}
                style={{ flexGrow: field.projectedPoints, flexBasis: 0 }}
                className="min-w-6 transition-[flex-grow] duration-500 motion-reduce:transition-none"
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
                          "flex h-full w-full items-center gap-1.5 overflow-hidden px-2 text-xs outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          SEGMENT_TONE[field.weightLabel],
                          field.fieldId === selectedFieldId &&
                            "shadow-[inset_0_-3px_0_0_var(--foreground)]",
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate">{field.label}</span>
                    <span className="ml-auto tabular-nums opacity-80">{field.projectedPoints}</span>
                  </HoverCardTrigger>
                  <HoverCardContent side="bottom" align="center" className="w-64 p-3">
                    <FieldSummary field={field} />
                  </HoverCardContent>
                </HoverCard>
              </li>
            );
          })}
        </ul>
      )}
      {stalledHigh.length > 0 && (
        <p role="status" className="text-xs text-amber-600 dark:text-amber-400">
          {formatConjunctionList(stalledHigh.map((f) => f.label))}{" "}
          {stalledHigh.length === 1 ? "is" : "are"} High priority with nothing open to research, so{" "}
          {stalledHigh.length === 1 ? "its" : "their"} share goes to other fields.
        </p>
      )}
    </section>
  );
}
