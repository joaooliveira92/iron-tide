import { LayoutDashboard } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import { humanizeId } from "../../../lib/humanize-id.js";
import { cn } from "../../../lib/utils.js";
import { stepSelection } from "../diplomacy-selection.js";
import type { BattleRecord } from "../diplomacy-hover.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { NationFlag } from "./NationFlag.js";
import { NationHoverCard } from "./NationHoverCard.js";

export interface NationRailProps {
  readonly rows: readonly DiplomacyRelationRow[];
  readonly records: ReadonlyMap<string, BattleRecord>;
  readonly overviewActive: boolean;
  readonly selectedId: string | null;
  readonly draftPartnerId: string | null;
  readonly onOverview: () => void;
  readonly onSelect: (partnerNationId: string) => void;
  readonly footer?: ReactNode;
}

function railMark(row: DiplomacyRelationRow): {
  readonly mark: string;
  readonly meaning: string;
  readonly tone: string;
} {
  if (row.atWar) {
    return { mark: "W", meaning: "at war", tone: "bg-destructive text-destructive-foreground" };
  }
  const meaning = `tension ${row.tension} of 10`;
  if (row.band === "hostile" || row.band === "war_imminent") {
    return {
      mark: String(row.tension),
      meaning,
      tone: "bg-destructive text-destructive-foreground",
    };
  }
  if (row.band === "strained") {
    return { mark: String(row.tension), meaning, tone: "text-amber-700 dark:text-amber-400" };
  }
  return { mark: String(row.tension), meaning, tone: "text-muted-foreground" };
}

const ITEM =
  "relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none max-xl:justify-center max-xl:px-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-accent data-[active=true]:font-medium";

const MARK =
  "ml-auto flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums max-xl:absolute max-xl:top-0 max-xl:right-0 max-xl:ml-0 max-xl:min-w-4 max-xl:text-xs";

export function NationRail({
  rows,
  records,
  overviewActive,
  selectedId,
  draftPartnerId,
  onOverview,
  onSelect,
  footer,
}: NationRailProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const nextId = stepSelection(rows, selectedId, event.key === "ArrowDown" ? 1 : -1);
    if (nextId === null) return;
    onSelect(nextId);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-nation-id="${CSS.escape(nextId)}"]`)
      ?.focus();
  };

  return (
    <nav aria-label="Nations" className="flex h-full min-h-0 flex-col gap-1 border-r p-1.5 xl:p-2">
      <button
        type="button"
        aria-current={overviewActive ? "location" : undefined}
        data-active={overviewActive}
        onClick={onOverview}
        className={ITEM}
      >
        <LayoutDashboard aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate max-xl:sr-only">Overview</span>
      </button>
      <p className="px-2 pt-1 text-xs text-muted-foreground max-xl:sr-only">By threat</p>
      <ul
        ref={listRef}
        aria-label="Relations by threat"
        onKeyDown={onKeyDown}
        className="themed-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {rows.length === 0 && (
          <li className="px-2 text-xs text-muted-foreground">No relations recorded yet</li>
        )}
        {rows.map((row) => {
          const { mark, meaning, tone } = railMark(row);
          const active = !overviewActive && row.partnerNationId === selectedId;
          return (
            <li key={row.partnerNationId}>
              <NationHoverCard row={row} record={records.get(row.partnerName)} side="right">
                <button
                  type="button"
                  data-nation-id={row.partnerNationId}
                  data-active={active}
                  aria-label={`${row.partnerName}, ${row.relationLabel}, ${meaning}`}
                  aria-current={active ? "location" : undefined}
                  onClick={() => onSelect(row.partnerNationId)}
                  className={ITEM}
                >
                  <NationFlag
                    url={row.flagUrl}
                    name={row.partnerName}
                    className="h-6 w-9 rounded-[3px] border border-border shadow-sm"
                  />
                  <span className="min-w-0 flex-1 max-xl:sr-only">
                    <span className="block truncate">{row.partnerName}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        row.atWar ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {[
                        row.relation === "neutral" ? null : row.relationLabel,
                        row.nap ? "NAP" : null,
                        humanizeId(row.band),
                      ]
                        .filter((part) => part !== null)
                        .join(", ")}
                    </span>
                  </span>
                  {draftPartnerId === row.partnerNationId && (
                    <span
                      role="img"
                      aria-label="Order drafted"
                      className="size-1.5 shrink-0 rounded-full bg-primary max-xl:absolute max-xl:bottom-1 max-xl:left-1"
                    />
                  )}
                  <span aria-hidden="true" className={cn(MARK, tone)}>
                    {mark}
                  </span>
                </button>
              </NationHoverCard>
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
