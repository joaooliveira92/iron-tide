import { resolveMessage } from "../../../content/uiCatalogue.js";
import {
  CATEGORY_ORDER,
  SEVERITY_FILTER_OPTIONS,
  categoryLabelKey,
  severityLabelKey,
} from "../turn-summary-format.js";
import {
  useTurnSummaryActions,
  useTurnSummaryMeta,
  useTurnSummaryState,
} from "./TurnSummaryContext.js";

export function TurnSummaryFilterBar() {
  const { filters } = useTurnSummaryState();
  const { actionableCount } = useTurnSummaryMeta();
  const { patchFilters, toggleActionableOnly } = useTurnSummaryActions();

  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="search"
        data-testid="turn-search"
        placeholder={resolveMessage("ui.turnSummary.searchPlaceholder")}
        aria-label={resolveMessage("ui.turnSummary.searchLabel")}
        className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-0.5 text-xs"
        value={filters.search}
        onChange={(event) => patchFilters({ search: event.target.value })}
      />
      <select
        data-testid="category-filter"
        aria-label={resolveMessage("ui.turnSummary.categoryLabel")}
        className="rounded border border-border/60 bg-background px-1 py-0.5 text-xs"
        value={filters.category}
        onChange={(event) => patchFilters({ category: event.target.value })}
      >
        <option value="ALL">{resolveMessage("ui.turnSummary.allCategories")}</option>
        {CATEGORY_ORDER.map((value) => (
          <option key={value} value={value}>
            {resolveMessage(categoryLabelKey(value))}
          </option>
        ))}
      </select>
      <select
        data-testid="severity-filter"
        aria-label={resolveMessage("ui.turnSummary.severityLabel")}
        className="rounded border border-border/60 bg-background px-1 py-0.5 text-xs"
        value={filters.severity}
        onChange={(event) => patchFilters({ severity: event.target.value })}
      >
        {SEVERITY_FILTER_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value === "ALL"
              ? resolveMessage("ui.turnSummary.allSeverities")
              : resolveMessage(severityLabelKey(value))}
          </option>
        ))}
      </select>
      <button
        type="button"
        data-testid="actionable-toggle"
        aria-pressed={filters.actionableOnly}
        className={`rounded border border-border/60 px-1.5 py-0.5 text-xs${
          filters.actionableOnly ? " bg-accent" : ""
        }`}
        onClick={toggleActionableOnly}
      >
        {resolveMessage("ui.turnSummary.actionable", { count: actionableCount })}
      </button>
    </div>
  );
}
