import type {
  EntityReferenceDto,
  TurnMessageDto,
} from "../../../../shared/turn-message-contract.js";
import { resolveMessage } from "../../../content/uiCatalogue.js";
import { SummaryDelta, summaryValueLabel } from "../components/summary/index.js";
import { useTurnSummaryMeta } from "./TurnSummaryContext.js";

export function TurnSummaryHistoricalRecord({
  message,
  ref,
}: {
  readonly message: TurnMessageDto;
  readonly ref: EntityReferenceDto;
}) {
  const { entityLabel } = useTurnSummaryMeta();
  const effects = message.effectRefs.filter(
    (effect) => effect.target.type === ref.type && effect.target.id === ref.id,
  );
  return (
    <div
      data-testid="entity-historical"
      className="mt-1 space-y-1 rounded border border-border/60 bg-muted/40 p-1.5"
    >
      <p className="text-xs text-muted-foreground">
        {resolveMessage("ui.turnSummary.unavailableEntity")}
      </p>
      <p className="text-xs font-medium">{entityLabel(ref)}</p>
      {effects.map((effect, index) => (
        <p key={index} className="text-xs text-muted-foreground">
          {effect.attribute}:{" "}
          <SummaryDelta
            from={summaryValueLabel(effect.previousValue)}
            to={summaryValueLabel(effect.newValue)}
          />
        </p>
      ))}
    </div>
  );
}
