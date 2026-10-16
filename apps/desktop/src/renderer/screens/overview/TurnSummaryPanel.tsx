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
  CATEGORY_LABELS,
  DEFAULT_FILTERS,
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

const SEVERITIES = ["ALL", "CRITICAL", "HIGH", "NORMAL", "LOW"] as const;

export interface TurnSummaryPanelProps {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
  readonly defaultOpen: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  /** Navigate to the entity a message concerns; unavailable entities open read-only in place. */
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
}

function MessageRow({
  message,
  pinnedIds,
  readIds,
  onTogglePinned,
  onToggleRead,
  onOpenEntity,
}: {
  readonly message: TurnMessageDto;
  readonly pinnedIds: readonly string[];
  readonly readIds: readonly string[];
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pinned = pinnedIds.includes(message.id);
  const read = readIds.includes(message.id);

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
          {message.severity}
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
                  onClick={() => onOpenEntity?.(ref)}
                >
                  {ref.type}: {ref.id}
                </button>
              ))}
            </div>
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
                  Sources: {message.debugMetadata.sourceEventIds.join(", ")}
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
            {expanded ? "Less" : "Details"}
          </button>
          <button
            type="button"
            data-testid="toggle-pin"
            aria-pressed={pinned}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onTogglePinned(message.id)}
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            data-testid="toggle-read"
            aria-pressed={read}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onToggleRead(message.id)}
          >
            {read ? "Unread" : "Read"}
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
      title="Turn summary"
      defaultOpen={defaultOpen}
      badge={summaries.length > 0 ? `${String(messages.length)}` : undefined}
      testId="home-turn-summary"
    >
      <div className="space-y-2 p-2" data-testid="turn-summary-panel">
        {loading && <p className="text-muted-foreground">Loading turn summary…</p>}
        {!loading && summaries.length === 0 && (
          <p className="text-muted-foreground" data-testid="turn-summary-empty">
            No resolved turns yet.
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
              placeholder="Search"
              aria-label="Search the turn summary"
              className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-0.5 text-xs"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
            <select
              data-testid="category-filter"
              aria-label="Filter by category"
              className="rounded border border-border/60 bg-background px-1 py-0.5 text-xs"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="ALL">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              data-testid="severity-filter"
              aria-label="Filter by severity"
              className="rounded border border-border/60 bg-background px-1 py-0.5 text-xs"
              value={filters.severity}
              onChange={(event) =>
                setFilters((current) => ({ ...current, severity: event.target.value }))
              }
            >
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All severities" : value}
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
              Actionable ({actionableCount})
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
              {group.label} ({group.messages.length})
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
                />
              ))}
            </ul>
          </section>
        ))}

        {!loading && messages.length > 0 && visible.length === 0 && (
          <p className="text-muted-foreground" data-testid="turn-summary-no-match">
            No messages match the current filters.
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
}
