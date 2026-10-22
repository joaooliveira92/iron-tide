import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { buildBudgetBar } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";

/**
 * Income against stacked expenditure on one scale. Never colour alone: the legend
 * names every segment with its value and share, and the whole bar has a text label.
 * All geometry, labels, and colours come from `buildBudgetBar`; this only renders.
 */
export function BudgetBar({ breakdown }: { readonly breakdown: TreasuryBreakdown }) {
  const format = usePresentationFormat();
  const bar = buildBudgetBar(breakdown);

  return (
    <div className="space-y-3" data-testid="budget-bar">
      <div className="relative">
        <div
          role="img"
          aria-label={bar.label}
          className="flex h-4 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border"
        >
          {bar.segments.map((segment) => (
            <div
              key={segment.id}
              className={segment.className}
              style={{ width: `${segment.width * 100}%` }}
            />
          ))}
        </div>
        {/* Income marker: spending beyond this line is a deficit. */}
        <div
          aria-hidden="true"
          className="absolute -top-1 h-6 w-0.5 bg-foreground"
          style={{ left: `calc(${bar.incomeMarker * 100}% - 1px)` }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {bar.segments.map((segment) => (
          <li key={segment.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-sm ${segment.className}`}
            />
            <span>{segment.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {format.money(segment.value)} ·{" "}
              {format.number(segment.shareOfSpend * 100, { maximumFractionDigits: 0 })}%
            </span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground" />
          <span>Income</span>
          <span className="tabular-nums text-muted-foreground">{format.money(bar.income)}</span>
        </li>
      </ul>
      {bar.overBudget && (
        <p className="text-xs text-destructive">
          Spending exceeds income by {format.money(bar.overBudgetBy)} this month.
        </p>
      )}
    </div>
  );
}
