import { cn } from "../../../lib/utils.js";
import type { NationRailRow } from "../nation-rail-state.js";
import { NationRelationBadge } from "./NationRelationBadge.js";
import { NationSwatch } from "./NationSwatch.js";

export function NationRailItem({
  row,
  selected,
  onSelect,
}: {
  readonly row: NationRailRow;
  readonly selected: boolean;
  readonly onSelect: (nationId: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        data-relation={row.relation}
        onClick={() => onSelect(row.nationId)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left outline-none transition-colors",
          "bg-muted/40 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
          "aria-pressed:border-ring/50 aria-pressed:bg-muted",
          row.isPlayer && "border-primary/30",
        )}
      >
        <NationSwatch row={row} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.name}</span>
        <NationRelationBadge row={row} />
        {row.warScore !== null && (
          <span
            className="text-xs font-semibold tabular-nums text-destructive"
            aria-label={`War score ${row.warScore.yours} to ${row.warScore.enemy}`}
          >
            {row.warScore.yours}:{row.warScore.enemy}
          </span>
        )}
      </button>
    </li>
  );
}
