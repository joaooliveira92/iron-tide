import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { YARD_PLACES, type RailMark, type RailTone, type YardPlaceId } from "../yard-workspace.js";

export interface YardRailProps {
  readonly active: YardPlaceId;
  readonly marks: Readonly<Record<YardPlaceId, RailMark>>;
  readonly onSelect: (place: YardPlaceId) => void;
  readonly footer?: ReactNode;
}

const MARK_TONE: Record<RailTone, string> = {
  quiet: "text-muted-foreground",
  attention: "bg-warning/20 text-amber-700 dark:text-amber-400",
  alert: "bg-destructive text-destructive-foreground",
};

export function YardRail({ active, marks, onSelect, footer }: YardRailProps) {
  return (
    <nav aria-label="Yard" className="flex h-full min-h-0 flex-col gap-1 border-r p-1.5 xl:p-2">
      <ul className="flex flex-col gap-1">
        {YARD_PLACES.map(({ id, label, icon: Icon }) => {
          const mark = marks[id];
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`${label}, ${mark.meaning}`}
                title={`${label}: ${mark.meaning}`}
                aria-current={active === id ? "location" : undefined}
                data-active={active === id}
                onClick={() => onSelect(id)}
                className="relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none max-xl:justify-center max-xl:px-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-accent data-[active=true]:font-medium"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate max-xl:sr-only">{label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-auto flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    "max-xl:absolute max-xl:top-0 max-xl:right-0 max-xl:ml-0 max-xl:min-w-4",
                    MARK_TONE[mark.tone],
                  )}
                >
                  {mark.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
