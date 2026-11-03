import { turnLabel } from "../turn-summary-format.js";
import {
  useTurnSummaryActions,
  useTurnSummaryMeta,
  useTurnSummaryState,
} from "./TurnSummaryContext.js";

export function TurnSummaryHistory() {
  const { summaries } = useTurnSummaryState();
  const { selected } = useTurnSummaryMeta();
  const { selectTurn } = useTurnSummaryActions();

  return (
    <div className="flex flex-wrap gap-1" data-testid="turn-history">
      {summaries.map((entry) => (
        <button
          key={entry.turnId}
          type="button"
          data-testid="turn-history-item"
          aria-pressed={entry.turnId === selected?.turnId}
          className={
            entry.turnId === selected?.turnId
              ? "rounded border px-1.5 py-0.5 text-xs bg-accent"
              : "rounded border px-1.5 py-0.5 text-xs"
          }
          onClick={() => selectTurn(entry.turnId)}
        >
          {turnLabel(entry)}
        </button>
      ))}
    </div>
  );
}
