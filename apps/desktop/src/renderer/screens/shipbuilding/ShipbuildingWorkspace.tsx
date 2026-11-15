import type { RevisionProject } from "../../components/design-workspace/revisionPreview.js";
import { ShipbuildingProvider } from "./workspace/WorkspaceContext.js";
import { WorkspaceLayout } from "./workspace/WorkspaceLayout.js";

export interface ShipbuildingWorkspaceProps {
  readonly sessionId?: string;
  readonly projects?: readonly RevisionProject[];
  readonly catalogue?: readonly RevisionProject[];
}

export function ShipbuildingWorkspace({
  sessionId,
  projects = [],
  catalogue,
}: ShipbuildingWorkspaceProps) {
  return (
    <ShipbuildingProvider sessionId={sessionId} projects={projects} catalogue={catalogue}>
      <WorkspaceLayout />
    </ShipbuildingProvider>
  );
}
