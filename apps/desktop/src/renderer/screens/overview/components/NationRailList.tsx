import type { NationRailRow } from "../nation-rail-state.js";
import { NationRailItem } from "./NationRailItem.js";

/** The player-first list of major powers; selection is owned by the rail, not the list. */
export function NationRailList({
  rows,
  selectedId,
  onSelect,
}: {
  readonly rows: readonly NationRailRow[];
  readonly selectedId: string | null;
  readonly onSelect: (nationId: string) => void;
}) {
  return (
    <ul className="space-y-1" aria-label="Major powers">
      {rows.map((row) => (
        <NationRailItem
          key={row.nationId}
          row={row}
          selected={row.nationId === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
