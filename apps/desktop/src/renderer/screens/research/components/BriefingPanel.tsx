import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ResearchBudgetView } from "../research-view-model.js";

const PIPELINE = [
  "The budget is paid from the treasury every month.",
  "It is split across fields that have an open technology, weighted High 4, Medium 2, Low 1.",
  "Each field researches one technology at a time. You steer fields; the technology is drawn by chance, weighted by discovery weight.",
  "A technology is discovered when its points reach its cost, which opens the technologies that follow it.",
] as const;

export function BriefingPanel({ budget }: { readonly budget: ResearchBudgetView }) {
  const format = usePresentationFormat();
  return (
    <div className="space-y-4">
      <section aria-label="Budget gauge" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {format.count(budget.monthly)}
          </span>
          <span className="text-xs text-muted-foreground">a month</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
              budget.lowSpending ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${budget.utilizationPct}%` }}
          />
          <span
            aria-hidden="true"
            title={`Guidance floor ${format.count(budget.floor)}`}
            className="absolute -top-1 h-4 w-px bg-foreground/60"
            style={{ left: `${budget.floorPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>0</span>
          <span>Floor {format.count(budget.floor)}</span>
          <span>Cap {format.count(budget.cap)}</span>
        </div>
        {budget.annualAllocation !== null && (
          <p className="text-xs text-muted-foreground">
            Authored annual allocation {format.count(budget.annualAllocation)}
          </p>
        )}
        {budget.lowSpending && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Research is below the 8% share of the naval appropriation that the admiralty advises.
          </p>
        )}
        {budget.note !== null && <p className="text-xs text-destructive">{budget.note}</p>}
      </section>

      <section aria-label="How research works" className="space-y-2">
        <h3 className="text-sm font-medium">How research works</h3>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground marker:text-foreground">
          {PIPELINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Priorities you set here apply when the next turn advances.
        </p>
      </section>
    </div>
  );
}
