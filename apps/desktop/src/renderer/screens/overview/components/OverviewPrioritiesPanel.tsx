import { CollapsiblePanel } from "../../../components/shared/CollapsiblePanel.js";
import type { Screen } from "../../../shell/campaign-screen-registry.js";
import { PrioritiesCard } from "../PrioritiesCard.js";
import type { PrioritiesState } from "../usePriorities.js";

/**
 * The home screen's "Immediate priorities" panel: a collapsible host that owns
 * only the panel chrome (title, urgency badge and default openness). The card
 * owns the content and the screen decides placement (CC-1, CC-2).
 */
export function OverviewPrioritiesPanel({
  state,
  priorityCount,
  defaultOpen,
  onNavigate,
}: {
  readonly state: PrioritiesState;
  readonly priorityCount: number | null;
  readonly defaultOpen: boolean;
  readonly onNavigate: (screen: Screen) => void;
}) {
  return (
    <CollapsiblePanel
      panelId="home-priorities"
      title="Immediate priorities"
      badge={priorityCount === null ? undefined : `(${priorityCount})`}
      defaultOpen={defaultOpen}
      testId="home-priorities"
    >
      <PrioritiesCard state={state} onNavigate={onNavigate} embedded />
    </CollapsiblePanel>
  );
}
