import { memo, useState } from "react";
import type {
  EntityReferenceDto,
  TurnMessageDto,
} from "../../../../shared/turn-message-contract.js";
import { resolveMessage } from "../../../content/uiCatalogue.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { constructionMessageBody } from "./construction-message-text.js";
import {
  SummaryDelta,
  SummaryRow,
  summaryDeltaLabel,
  summaryValueLabel,
} from "../components/summary/index.js";
import { severityLabelKey } from "../turn-summary-format.js";
import { TurnSummaryHistoricalRecord } from "./TurnSummaryHistoricalRecord.js";
import { useTurnSummaryActions, useTurnSummaryMeta } from "./TurnSummaryContext.js";

const SEVERITY_CLASS: Readonly<Record<string, string>> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  HIGH: "bg-amber-500 text-black",
  NORMAL: "bg-muted text-foreground",
  LOW: "bg-muted text-muted-foreground",
  TRACE: "bg-muted text-muted-foreground",
};

export const TurnSummaryMessageRow = memo(function TurnSummaryMessageRow({
  message,
  pinned,
  read,
}: {
  readonly message: TurnMessageDto;
  readonly pinned: boolean;
  readonly read: boolean;
}) {
  const format = usePresentationFormat();
  const { openEntity, togglePinned, toggleRead } = useTurnSummaryActions();
  const { isEntityAvailable } = useTurnSummaryMeta();
  const [expanded, setExpanded] = useState(false);
  const [historicalRef, setHistoricalRef] = useState<EntityReferenceDto | null>(null);

  const handleOpenEntity = (ref: EntityReferenceDto): void => {
    if (!isEntityAvailable(ref)) {
      setHistoricalRef(ref);
      return;
    }
    openEntity(ref);
  };

  return (
    <SummaryRow
      variant="turn"
      testId="turn-message"
      messageId={message.id}
      severity={message.severity}
    >
      <div className="flex items-start gap-2">
        <span
          data-testid="severity-badge"
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
            SEVERITY_CLASS[message.severity] ?? ""
          }`}
        >
          {resolveMessage(severityLabelKey(message.severity))}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${read ? "text-muted-foreground" : ""}`}>
            {resolveMessage(message.titleKey, message.interpolation)}
          </p>
          <p className="text-muted-foreground">
            {constructionMessageBody(message.bodyKey, message.interpolation, format) ??
              resolveMessage(message.bodyKey, message.interpolation)}
          </p>
          {message.subjectRefs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.subjectRefs.map((ref) => (
                <button
                  key={`${ref.type}:${ref.id}`}
                  type="button"
                  data-testid="entity-link"
                  className="rounded border border-border/60 px-1.5 py-0.5 text-xs hover:bg-accent"
                  onClick={() => handleOpenEntity(ref)}
                >
                  {ref.type}: {ref.id}
                </button>
              ))}
            </div>
          )}
          {historicalRef !== null && (
            <TurnSummaryHistoricalRecord message={message} ref={historicalRef} />
          )}
          {expanded && (
            <div data-testid="message-detail" className="mt-1 space-y-1">
              {message.effectRefs.map((effect, index) => (
                <p key={index} className="text-xs text-muted-foreground">
                  {effect.target.type}:{effect.target.id} {effect.attribute}:{" "}
                  <SummaryDelta
                    from={summaryValueLabel(effect.previousValue)}
                    to={summaryValueLabel(effect.newValue)}
                    delta={effect.delta === undefined ? undefined : summaryDeltaLabel(effect.delta)}
                  />
                </p>
              ))}
              {message.debugMetadata ? (
                <p className="text-xs text-muted-foreground">
                  {resolveMessage("ui.turnSummary.sources", {
                    sources: message.debugMetadata.sourceEventIds.join(", "),
                  })}
                </p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            data-testid="toggle-detail"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {resolveMessage(expanded ? "ui.turnSummary.less" : "ui.turnSummary.details")}
          </button>
          <button
            type="button"
            data-testid="toggle-pin"
            aria-pressed={pinned}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => togglePinned(message.id)}
          >
            {resolveMessage(pinned ? "ui.turnSummary.unpin" : "ui.turnSummary.pin")}
          </button>
          <button
            type="button"
            data-testid="toggle-read"
            aria-pressed={read}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => toggleRead(message.id)}
          >
            {resolveMessage(read ? "ui.turnSummary.unread" : "ui.turnSummary.read")}
          </button>
        </div>
      </div>
    </SummaryRow>
  );
});
