import { CollapsiblePanel } from "../../../components/shared/CollapsiblePanel.js";
import type { Screen } from "../../../shell/campaign-screen-registry.js";
import { NationRail } from "../NationRail.js";
import type { NationRailLoad } from "../useNationRail.js";

/**
 * The home screen's "Nations" panel: a collapsible host that owns only the panel
 * chrome. The rail owns the nation list and the screen decides placement
 * (CC-1, CC-2).
 */
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
  return (
    <CollapsiblePanel
      panelId="home-nations"
      title="Nations"
      defaultOpen={defaultOpen}
      testId="home-nations"
    >
      <NationRail state={state} playerName={playerName} onNavigate={onNavigate} embedded />
    </CollapsiblePanel>
  );
}
