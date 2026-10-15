import type { NationRailRow } from "../nation-rail-state.js";
import { NationSwatch } from "./NationSwatch.js";

/** One nation in the rail: flag/hue swatch, name, relation words and war score while at war. */
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
        onClick={() => onSelect(row.nationId)}
        className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-accent aria-pressed:bg-accent"
      >
        <NationSwatch row={row} />
        <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
        <span className="text-muted-foreground">{row.relationLabel}</span>
        {row.warScore !== null && (
          <span
            className="tabular-nums"
            aria-label={`War score ${row.warScore.yours} to ${row.warScore.enemy}`}
          >
            {row.warScore.yours}:{row.warScore.enemy}
          </span>
        )}
      </button>
    </li>
  );
}
