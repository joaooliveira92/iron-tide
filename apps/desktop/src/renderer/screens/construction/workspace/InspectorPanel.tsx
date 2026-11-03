import { Inspector } from "../../shipbuilding/components/Inspector.js";
import { InspectorResizeHandle } from "../../shipbuilding/components/InspectorResizeHandle.js";
import { useReviseProject } from "../../../shell/CampaignShellContext.js";
import {
  CommandInspector,
  DesignInspector,
  ProjectInspector,
  YardOverview,
} from "../components/index.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function InspectorPanel() {
  const { screen } = useConstructionState();
  const { closeWizard, confirmOrder, halt, resume, setAcceleration, cancelProject, setTab } =
    useConstructionActions();
  const {
    place,
    tab,
    currentPlace,
    selectedRow,
    selectedCommand,
    selectedDesign,
    busy,
    inspector,
    inspectorId,
  } = useConstructionMeta();
  const reviseProject = useReviseProject();
  const workspace = screen.workspace;
  const economy = screen.economy;
  if (workspace === null || economy === null) return null;

  const body = (() => {
    if (tab.id === "yard") return <YardOverview economy={economy} workspace={workspace} />;
    if (place === "slipways") {
      return (
        <ProjectInspector
          row={selectedRow ?? null}
          pending={busy}
          onHalt={halt}
          onResume={resume}
          onAccelerate={setAcceleration}
          onCancelProject={cancelProject}
          onRevise={reviseProject}
        />
      );
    }
    if (place === "catalog") {
      return (
        <DesignInspector
          tab={tab.id}
          design={selectedDesign}
          economy={economy}
          workspace={workspace}
          busy={busy}
          notice={screen.notice}
          onConfirm={confirmOrder}
          onBackToDesign={closeWizard}
        />
      );
    }
    return (
      <CommandInspector
        command={selectedCommand}
        commands={workspace.commands}
        economy={economy}
        workspace={workspace}
      />
    );
  })();

  return (
    <div id={inspectorId} className="relative min-h-0">
      {!inspector.layout.collapsed && (
        <InspectorResizeHandle
          widthPx={inspector.layout.widthPx}
          onChange={inspector.setWidth}
          controls={inspectorId}
          className="absolute inset-y-0 -left-2 z-10 w-4"
        />
      )}
      <Inspector
        title={place === "catalog" ? "Design catalog" : currentPlace.label}
        breadcrumb={["Yard", currentPlace.label, tab.label]}
        tabs={currentPlace.tabs}
        tab={tab.id}
        onTab={(next) => setTab(place, next)}
        collapsed={inspector.layout.collapsed}
        onToggleCollapsed={inspector.toggleCollapsed}
      >
        {body}
      </Inspector>
    </div>
  );
}
