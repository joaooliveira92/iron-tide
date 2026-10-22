import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { CardShell } from "../../components/shared/CardShell.js";
import { CardTitle } from "../../components/ui/card.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import { NationDeferredIntel } from "./components/NationDeferredIntel.js";
import { NationRailControls } from "./components/NationRailControls.js";
import { NationRailList } from "./components/NationRailList.js";
import { buildNationRail } from "./nation-rail-state.js";
import {
  arrangeNationRail,
  summarizeNationRail,
  type NationRailFilter,
  type NationRailSort,
} from "./nation-rail-view.js";
import type { NationRailLoad } from "./useNationRail.js";

export interface NationRailProps {
  readonly state: NationRailLoad;
  readonly playerName: string;
  readonly onNavigate: (screen: Screen) => void;
  readonly embedded?: boolean;
}

export function NationRail({ state, playerName, onNavigate, embedded = false }: NationRailProps) {
  const rows = useMemo(
    () => (state.status === "ready" ? buildNationRail(state.projection, playerName) : []),
    [state, playerName],
  );

  const [filter, setFilter] = useState<NationRailFilter>("all");
  const [sort, setSort] = useState<NationRailSort>("name");
  const summary = useMemo(() => summarizeNationRail(rows), [rows]);
  const arrangement = useMemo(() => arrangeNationRail(rows, filter, sort), [rows, filter, sort]);

  return (
    <CardShell
      testId="nation-rail"
      embedded={embedded}
      header={<CardTitle className="text-sm font-medium">Nations</CardTitle>}
      contentClassName="space-y-3 text-xs"
    >
      {state.status === "loading" && <p className="text-muted-foreground">Reading relations…</p>}
      {state.status === "unavailable" && (
        <p role="alert" className="text-muted-foreground">
          Relations are unavailable right now.
        </p>
      )}
      {state.status === "ready" && (
        <>
          <NationRailControls
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onSort={setSort}
            summary={summary}
            total={rows.length - 1}
          />
          <NationRailList arrangement={arrangement} onOpen={() => onNavigate("diplomacy")} />
        </>
      )}

      <NationDeferredIntel />

      <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("diplomacy")}>
        All relations
      </Button>
    </CardShell>
  );
}
