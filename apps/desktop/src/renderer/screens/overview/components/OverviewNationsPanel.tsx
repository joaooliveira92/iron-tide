import { useMemo } from "react";

import { CollapsiblePanel } from "../../../components/shared/CollapsiblePanel.js";
import type { Screen } from "../../../shell/campaign-screen-registry.js";
import { NationRail } from "../NationRail.js";
import { buildNationRail } from "../nation-rail-state.js";
import { describeNationRailSummary, summarizeNationRail } from "../nation-rail-view.js";
import type { NationRailLoad } from "../useNationRail.js";

function useHeaderBadge(state: NationRailLoad, playerName: string): string | undefined {
  return useMemo(() => {
    if (state.status !== "ready") return undefined;
    const summary = summarizeNationRail(buildNationRail(state.projection, playerName));
    if (summary.attention > 0) return `${String(summary.attention)} need attention`;
    return describeNationRailSummary(summary) || undefined;
  }, [state, playerName]);
}

export function OverviewNationsPanel({
  state,
  playerName,
  defaultOpen,
  onNavigate,
}: {
  readonly state: NationRailLoad;
  readonly playerName: string;
  readonly defaultOpen: boolean;
  readonly onNavigate: (screen: Screen) => void;
}) {
  const badge = useHeaderBadge(state, playerName);
  return (
    <CollapsiblePanel
      panelId="home-nations"
      title="Nations"
      defaultOpen={defaultOpen}
      testId="home-nations"
      badge={badge}
    >
      <NationRail state={state} playerName={playerName} onNavigate={onNavigate} embedded />
    </CollapsiblePanel>
  );
}
