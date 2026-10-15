import { buildBudgetBar } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Income against stacked expenditure on one scale. Never colour alone: the legend
 * names every segment with its value and share, and the whole bar has a text label.
 * All geometry, labels, and colours come from `buildBudgetBar`; this only renders.
 */
export function BudgetBar({ breakdown }: { readonly breakdown: TreasuryBreakdown }) {
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
              {segment.value.toLocaleString()} · {percent(segment.shareOfSpend)}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground" />
          <span>Income</span>
          <span className="tabular-nums text-muted-foreground">{bar.income.toLocaleString()}</span>
        </li>
      </ul>
      {bar.overBudget && (
        <p className="text-xs text-destructive">
          Spending exceeds income by {bar.overBudgetBy.toLocaleString()} this month.
        </p>
      )}
    </div>
  );
}
