import { resolveMessage } from "../../../content/uiCatalogue.js";
import { useTurnSummaryMeta, useTurnSummaryState } from "./TurnSummaryContext.js";

export function TurnSummaryStatus() {
  const { loading } = useTurnSummaryState();
  const { isEmpty } = useTurnSummaryMeta();

  if (loading) {
    return <p className="text-muted-foreground">{resolveMessage("ui.turnSummary.loading")}</p>;
  }
  if (isEmpty) {
    return (
      <p className="text-muted-foreground" data-testid="turn-summary-empty">
        {resolveMessage("ui.turnSummary.empty")}
      </p>
    );
  }
  return null;
}

export function TurnSummaryNoMatch() {
  const { noMatch } = useTurnSummaryMeta();
  if (!noMatch) {
    return null;
  }
  return (
    <p className="text-muted-foreground" data-testid="turn-summary-no-match">
      {resolveMessage("ui.turnSummary.noMatch")}
    </p>
  );
}
