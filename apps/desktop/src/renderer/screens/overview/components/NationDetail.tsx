import type { ReactNode } from "react";

import type { NationRailRow } from "../nation-rail-state.js";
import { NationRelationBadge } from "./NationRelationBadge.js";

function Stat({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-2.5 py-1.5">
      <dt className="text-xs leading-4 text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

export function NationDetail({ selected }: { readonly selected: NationRailRow }) {
  return (
    <div data-testid="nation-rail-detail">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {selected.name}
        </p>
        <NationRelationBadge row={selected} />
      </div>
      {selected.isPlayer ? (
        <p className="px-3 py-2.5 text-muted-foreground">Your nation.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-1.5 p-2">
          <Stat label="Relation">{selected.relationLabel}</Stat>
          {selected.tension !== null && <Stat label="Tension">{selected.tension}/10</Stat>}
          {selected.since !== null && <Stat label="Since">{selected.since}</Stat>}
          {selected.warScore !== null && (
            <Stat label="War score">
              you {selected.warScore.yours} : {selected.warScore.enemy} them
            </Stat>
          )}
        </dl>
      )}
    </div>
  );
}
