import type { NationRailArrangement } from "../nation-rail-view.js";
import { NationRailItem } from "./NationRailItem.js";

export function NationRailList({
  arrangement,
  onOpen,
}: {
  readonly arrangement: NationRailArrangement;
  readonly onOpen: () => void;
}) {
  const { player, groups } = arrangement;
  return (
    <div className="space-y-2" aria-label="Major powers" role="group">
      {player !== null && (
        <ul className="space-y-1" aria-label="Your nation">
          <NationRailItem row={player} onOpen={onOpen} />
        </ul>
      )}
      {groups.map((group) => (
        <section key={group.id} data-group={group.id} aria-label={group.label}>
          <h3 className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase leading-4 tracking-widest text-muted-foreground">
            {group.label}
            <span className="tabular-nums">{group.rows.length}</span>
          </h3>
          <ul className="space-y-1">
            {group.rows.map((row) => (
              <NationRailItem key={row.nationId} row={row} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
