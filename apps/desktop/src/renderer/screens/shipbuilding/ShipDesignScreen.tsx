import { useEffect, useMemo } from "react";
import { useDrawingBoardContentSource } from "../../components/design-workspace/useDrawingBoardContent.js";
import { useRevisionRequest } from "../../shell/CampaignShellContext.js";
import { useConstructionScreen } from "../construction/hooks/useConstructionScreen.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

const NOTICE =
  "p-6 pt-[calc(var(--chrome-top,0px)+1.5rem)] text-sm pb-[calc(var(--chrome-bottom,0px)+1.5rem)]";

function RevisingWorkspace({
  sessionId,
  projectId,
}: {
  readonly sessionId: string;
  readonly projectId: string;
}) {
  const { state, loadScreen } = useConstructionScreen(sessionId);
  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);
  const projects = useMemo(
    () => state.projects.filter((project) => project.projectId === projectId),
    [state.projects, projectId],
  );
  return <ShipbuildingWorkspace sessionId={sessionId} projects={projects} />;
}

export function ShipDesignScreen({ sessionId }: { readonly sessionId: string }) {
  const contentStatus = useDrawingBoardContentSource();
  const { projectId, clear } = useRevisionRequest();
  useEffect(() => clear, [clear]);
  if (contentStatus === "error")
    return (
      <p role="alert" className={`${NOTICE} text-destructive`}>
        Could not load ship-building content from the campaign service.
      </p>
    );
  if (contentStatus !== "ready")
    return (
      <p role="status" className={`${NOTICE} text-muted-foreground`}>
        Loading ship-building content…
      </p>
    );
  return projectId === null ? (
    <ShipbuildingWorkspace sessionId={sessionId} />
  ) : (
    <RevisingWorkspace sessionId={sessionId} projectId={projectId} />
  );
}
