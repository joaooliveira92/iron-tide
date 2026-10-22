import { useDrawingBoardContentSource } from "../../components/design-workspace/index.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

export function ShipbuildingContentGate({ sessionId }: { readonly sessionId?: string }) {
  const contentStatus = useDrawingBoardContentSource();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {contentStatus === "ready" ? (
        <ShipbuildingWorkspace sessionId={sessionId} />
      ) : contentStatus === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load ship-building content from the campaign service.
        </p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Loading ship-building content…
        </p>
      )}
    </div>
  );
}
