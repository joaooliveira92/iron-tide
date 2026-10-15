import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { CardShell } from "../../components/shared/CardShell.js";
import { CardTitle } from "../../components/ui/card.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import { NationDeferredIntel } from "./components/NationDeferredIntel.js";
import { NationDetail } from "./components/NationDetail.js";
import { NationRailList } from "./components/NationRailList.js";
import { buildNationRail } from "./nation-rail-state.js";
import type { NationRailLoad } from "./useNationRail.js";

export interface NationRailProps {
  readonly state: NationRailLoad;
  readonly playerName: string;
  readonly onNavigate: (screen: Screen) => void;
  /** Render only the body (a host panel supplies the chrome and the "Nations" title). */
  readonly embedded?: boolean;
}

/**
 * Right-rail nation list (CC-5): the player first, then the other powers with
 * their relation to the player in words and the war score while at war.
 *
 * Selection: there is no nation drawer, and the Diplomacy & War screen takes no
 * nation parameter (navigation is by screen id only), so selecting a nation
 * only selects it and shows its relation detail inline under the list.
 */
export function NationRail({ state, playerName, onNavigate, embedded = false }: NationRailProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(
    () => (state.status === "ready" ? buildNationRail(state.projection, playerName) : []),
    [state, playerName],
  );
  const selected = rows.find((r) => r.nationId === selectedId) ?? null;
  const toggle = (nationId: string) =>
    setSelectedId((current) => (current === nationId ? null : nationId));

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
        <NationRailList rows={rows} selectedId={selectedId} onSelect={toggle} />
      )}

      {selected !== null && <NationDetail selected={selected} />}

      <NationDeferredIntel />

      <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("diplomacy")}>
        All relations
      </Button>
    </CardShell>
  );
}
