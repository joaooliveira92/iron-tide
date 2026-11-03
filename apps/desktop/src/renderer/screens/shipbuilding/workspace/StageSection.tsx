import { HullPlanPanel } from "../../../components/design-workspace/panels/hull-plan/HullPlanPanel.js";
import { ShipViewBoundary } from "../../../components/design-workspace/workspace/ShipViewBoundary.js";
import { ShipStage } from "../components/ShipStage.js";
import { ViewToolbar } from "../components/ViewToolbar.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function StageSection() {
  const { draft, findings } = useShipbuildingState();
  const {
    model,
    editing,
    shipView,
    overlays,
    isoSide,
    findingsView,
    armourHighlight,
    selectedInstanceId,
    focusArcs,
  } = useShipbuildingMeta();
  const { setShipView, setIsoSide, flipOverlay, setFindingsView } = useShipbuildingActions();
  return (
    <ShipStage
      toolbar={
        <ViewToolbar
          view={shipView}
          onView={setShipView}
          overlays={overlays}
          onToggleOverlay={flipOverlay}
          isoSide={isoSide}
          onIsoSide={setIsoSide}
          findingsView={findingsView}
          onFindingsView={setFindingsView}
        />
      }
    >
      <ShipViewBoundary resetKey={draft}>
        <HullPlanPanel
          findings={findings}
          model={model}
          editing={editing}
          shipView={shipView}
          overlays={overlays}
          armourHighlight={armourHighlight}
          findingsView={findingsView}
          onFindingsView={setFindingsView}
          isoSide={isoSide}
          highlightId={selectedInstanceId ?? undefined}
          focusArcs={focusArcs}
        />
      </ShipViewBoundary>
    </ShipStage>
  );
}
