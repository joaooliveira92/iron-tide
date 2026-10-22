import type { NationRailRow } from "../nation-rail-state.js";

export function NationDetail({ selected }: { readonly selected: NationRailRow }) {
  return (
    <div className="rounded-md border px-3 py-2" data-testid="nation-rail-detail">
      <p className="font-medium">{selected.name}</p>
      {selected.isPlayer ? (
        <p className="text-muted-foreground">Your nation.</p>
      ) : (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted-foreground">Relation</dt>
          <dd>{selected.relationLabel}</dd>
          {selected.tension !== null && (
            <>
              <dt className="text-muted-foreground">Tension</dt>
              <dd>{selected.tension}/10</dd>
            </>
          )}
          {selected.since !== null && (
            <>
              <dt className="text-muted-foreground">Since</dt>
              <dd>{selected.since}</dd>
            </>
          )}
          {selected.warScore !== null && (
            <>
              <dt className="text-muted-foreground">War score</dt>
              <dd>
                you {selected.warScore.yours} : {selected.warScore.enemy} them
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
