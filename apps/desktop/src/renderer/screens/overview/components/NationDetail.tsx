import type { ReactNode } from "react";

import { SlateBody, SlateHeader, SlateStat } from "../../../components/ui/slate.js";
import type { NationRailRow } from "../nation-rail-state.js";
import { NationRelationBadge } from "./NationRelationBadge.js";

export function NationDetail({ selected }: { readonly selected: NationRailRow }) {
  const stats: readonly { readonly label: string; readonly value: ReactNode }[] = selected.isPlayer
    ? []
    : [
        { label: "Relation", value: selected.relationLabel },
        ...(selected.tension === null
          ? []
          : [{ label: "Tension", value: `${selected.tension}/10` }]),
        ...(selected.since === null ? [] : [{ label: "Since", value: selected.since }]),
        ...(selected.warScore === null
          ? []
          : [
              {
                label: "War score",
                value: `you ${selected.warScore.yours} : ${selected.warScore.enemy} them`,
              },
            ]),
      ];
  return (
    <div data-testid="nation-rail-detail">
      <SlateHeader title={selected.name} aside={<NationRelationBadge row={selected} />} />
      {selected.isPlayer ? (
        <SlateBody>
          <p className="text-muted-foreground">Your nation.</p>
        </SlateBody>
      ) : (
        <dl className="grid grid-cols-2 gap-1.5 p-2">
          {stats.map((stat) => (
            <SlateStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </dl>
      )}
    </div>
  );
}
