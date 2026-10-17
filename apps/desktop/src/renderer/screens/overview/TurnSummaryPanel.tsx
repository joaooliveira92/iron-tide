import { useState } from "react";
import type {
  EntityReferenceDto,
  TurnMessageDto,
  TurnSummaryEntry,
  UiStateTurnMessages,
} from "../../../shared/campaign-command-contract.js";
import { CollapsiblePanel } from "../../components/shared/CollapsiblePanel.js";
import { resolveMessage } from "../../content/uiCatalogue.js";
import {
  CATEGORY_ORDER,
  DEFAULT_FILTERS,
  SEVERITY_ORDER,
  filterTurnMessages,
  groupTurnMessages,
  isActionable,
  turnLabel,
  type TurnSummaryFilters,
} from "./turn-summary-format.js";

const SEVERITY_CLASS: Readonly<Record<string, string>> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  HIGH: "bg-amber-500 text-black",
  NORMAL: "bg-muted text-foreground",
  LOW: "bg-muted text-muted-foreground",
  TRACE: "bg-muted text-muted-foreground",
};

/** Filter options: every severity except developer-only TRACE, plus "ALL". */
const SEVERITIES = ["ALL", ...SEVERITY_ORDER.filter((severity) => severity !== "TRACE")] as const;

/** The catalogue key for a message category's display label. */
function categoryLabelKey(category: string): string {
  return `ui.turnSummary.category.${category}`;
}

/** The catalogue key for a severity's display label. */
function severityLabelKey(severity: string): string {
  return `ui.turnSummary.severity.${severity}`;
}

export interface TurnSummaryPanelProps {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
  readonly defaultOpen: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  /** Navigate to the entity a message concerns; unavailable entities open read-only in place. */
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
  /**
   * Whether an entity still exists in the current campaign. When it does not
   * (sunk, scrapped, or otherwise gone), the link opens the message's stored
   * historical record in place instead of navigating (ticket 06/T5). Defaults
   * to "available" so links are unchanged without a signal.
   */
  readonly isEntityAvailable?: (ref: EntityReferenceDto) => boolean;
}

/** A read-only historical record for an entity a message concerns but which is no longer present. */
function EntityHistoricalRecord({
  message,
  ref,
}: {
  readonly message: TurnMessageDto;
  readonly ref: EntityReferenceDto;
}) {
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
      <p className="text-xs font-medium">
        {ref.type}: {ref.id}
      </p>
      {effects.map((effect, index) => (
        <p key={index} className="text-xs text-muted-foreground">
          {effect.attribute}: {String(effect.previousValue ?? "—")} →{" "}
          {String(effect.newValue ?? "—")}
        </p>
      ))}
    </div>
  );
}

function MessageRow({
  message,
  pinnedIds,
  readIds,
  onTogglePinned,
  onToggleRead,
  onOpenEntity,
  isEntityAvailable,
}: {
  readonly message: TurnMessageDto;
  readonly pinnedIds: readonly string[];
  readonly readIds: readonly string[];
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
  readonly isEntityAvailable?: (ref: EntityReferenceDto) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historicalRef, setHistoricalRef] = useState<EntityReferenceDto | null>(null);
  const pinned = pinnedIds.includes(message.id);
  const read = readIds.includes(message.id);

  const openEntity = (ref: EntityReferenceDto): void => {
    if (isEntityAvailable !== undefined && !isEntityAvailable(ref)) {
      setHistoricalRef(ref);
      return;
    }
    onOpenEntity?.(ref);
  };

  return (
    <li
      data-testid="turn-message"
      data-message-id={message.id}
      data-severity={message.severity}
      className="rounded-md border border-border/60 bg-background/60 p-2"
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
            {resolveMessage(message.bodyKey, message.interpolation)}
          </p>
          {message.subjectRefs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.subjectRefs.map((ref) => (
                <button
                  key={`${ref.type}:${ref.id}`}
                  type="button"
                  data-testid="entity-link"
                  className="rounded border border-border/60 px-1.5 py-0.5 text-xs hover:bg-accent"
                  onClick={() => openEntity(ref)}
                >
                  {ref.type}: {ref.id}
                </button>
              ))}
            </div>
          )}
          {historicalRef !== null && (
            <EntityHistoricalRecord message={message} ref={historicalRef} />
          )}
          {expanded && (
            <div data-testid="message-detail" className="mt-1 space-y-1">
              {message.effectRefs.map((effect, index) => (
                <p key={index} className="text-xs text-muted-foreground">
                  {effect.target.type}:{effect.target.id} {effect.attribute}:{" "}
                  {String(effect.previousValue ?? "—")} → {String(effect.newValue ?? "—")}
                  {effect.delta !== undefined
                    ? ` (${effect.delta >= 0 ? "+" : ""}${effect.delta})`
                    : ""}
                </p>
              ))}
              {message.debugMetadata && (
                <p className="text-xs text-muted-foreground">
                  {resolveMessage("ui.turnSummary.sources", {
                    sources: message.debugMetadata.sourceEventIds.join(", "),
                  })}
                </p>
              )}
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
            onClick={() => onTogglePinned(message.id)}
          >
            {resolveMessage(pinned ? "ui.turnSummary.unpin" : "ui.turnSummary.pin")}
          </button>
          <button
            type="button"
            data-testid="toggle-read"
            aria-pressed={read}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onToggleRead(message.id)}
          >
            {resolveMessage(read ? "ui.turnSummary.unread" : "ui.turnSummary.read")}
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * The grouped, filterable turn-summary panel (ticket 06). It renders only
 * validated `TurnSummaryEntry` DTOs — never authoritative state — grouping by
 * category, filtering by category/severity, searching, and restricting to
 * actionable items. Routine aggregates expand to their references and effect
 * deltas; every message links to the entities it concerns. Pin/read state is
 * presentation-only and never deletes history.
 */
export function TurnSummaryPanel({
  summaries,
  loading,
  defaultOpen,
  turnMessages,
  onTogglePinned,
  onToggleRead,
  onOpenEntity,
  isEntityAvailable,
}: TurnSummaryPanelProps) {
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TurnSummaryFilters>(DEFAULT_FILTERS);

  const selected =
    summaries.find((entry) => entry.turnId === selectedTurnId) ?? summaries[0] ?? null;
  const messages = selected?.messages ?? [];
  const visible = filterTurnMessages(messages, filters);
  const groups = groupTurnMessages(visible);
  const actionableCount = messages.filter(isActionable).length;

  return (
    <CollapsiblePanel
      panelId="home-turn-summary"
      title={resolveMessage("ui.turnSummary.title")}
      defaultOpen={defaultOpen}
      badge={summaries.length > 0 ? `${String(messages.length)}` : undefined}
      testId="home-turn-summary"
    >
      <div className="space-y-2 p-2" data-testid="turn-summary-panel">
        {loading && (
          <p className="text-muted-foreground">{resolveMessage("ui.turnSummary.loading")}</p>
        )}
        {!loading && summaries.length === 0 && (
          <p className="text-muted-foreground" data-testid="turn-summary-empty">
            {resolveMessage("ui.turnSummary.empty")}
          </p>
        )}

        {summaries.length > 1 && (
          <div className="flex flex-wrap gap-1" data-testid="turn-history">
            {summaries.map((entry) => (
              <button
                key={entry.turnId}
                type="button"
                data-testid="turn-history-item"
                aria-pressed={entry.turnId === selected?.turnId}
                className={`rounded border px-1.5 py-0.5 text-xs ${
                  entry.turnId === selected?.turnId ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedTurnId(entry.turnId)}
              >
                {turnLabel(entry)}
              </button>
            ))}
          </div>
        )}

        {summaries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="search"
              data-testid="turn-search"
              placeholder={resolveMessage("ui.turnSummary.searchPlaceholder")}
              aria-label={resolveMessage("ui.turnSummary.searchLabel")}
              className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-0.5 text-xs"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
            <select
              data-testid="category-filter"
              aria-label={resolveMessage("ui.turnSummary.categoryLabel")}
              className="rounded border border-border/60 bg-background px-1 py-0.5 text-xs"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
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
              onChange={(event) =>
                setFilters((current) => ({ ...current, severity: event.target.value }))
              }
            >
              {SEVERITIES.map((value) => (
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
              className={`rounded border border-border/60 px-1.5 py-0.5 text-xs ${
                filters.actionableOnly ? "bg-accent" : ""
              }`}
              onClick={() =>
                setFilters((current) => ({ ...current, actionableOnly: !current.actionableOnly }))
              }
            >
              {resolveMessage("ui.turnSummary.actionable", { count: actionableCount })}
            </button>
          </div>
        )}

        {groups.map((group) => (
          <section
            key={group.category}
            data-testid="turn-message-group"
            data-category={group.category}
          >
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {resolveMessage(categoryLabelKey(group.category))} ({group.messages.length})
            </h3>
            <ul className="space-y-1">
              {group.messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  pinnedIds={turnMessages.pinnedIds}
                  readIds={turnMessages.readIds}
                  onTogglePinned={onTogglePinned}
                  onToggleRead={onToggleRead}
                  {...(onOpenEntity !== undefined ? { onOpenEntity } : {})}
                  {...(isEntityAvailable !== undefined ? { isEntityAvailable } : {})}
                />
              ))}
            </ul>
          </section>
        ))}

        {!loading && messages.length > 0 && visible.length === 0 && (
          <p className="text-muted-foreground" data-testid="turn-summary-no-match">
            {resolveMessage("ui.turnSummary.noMatch")}
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
}
