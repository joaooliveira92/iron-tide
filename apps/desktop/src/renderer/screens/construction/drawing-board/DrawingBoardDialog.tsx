import { useState } from "react";
import { PencilRuler } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.js";
import { DrawingBoard } from "./DrawingBoard.js";
import {
  useDrawingBoardContentSource,
  type RevisionProject,
} from "../../../components/design-workspace/index.js";

export function DrawingBoardDialog({
  sessionId,
  projects,
}: { readonly sessionId?: string; readonly projects?: readonly RevisionProject[] } = {}) {
  const [open, setOpen] = useState(false);
  const contentStatus = useDrawingBoardContentSource();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-start gap-3 rounded border p-4">
        <p className="text-sm text-muted-foreground">
          Design a ship component by component: hull, machinery, armament and arrangement, with live
          validation, cost and build-time forecasts.
        </p>
        <Button onClick={() => setOpen(true)}>
          <PencilRuler aria-hidden="true" className="mr-1 size-4" />
          Open Drawing Board
        </Button>
      </div>
      <DialogContent className="flex h-[96vh] w-[98vw] max-w-none flex-col gap-3 overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>Drawing Board</DialogTitle>
          <DialogDescription>
            Your design is saved as you work. Nothing is built until you submit it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {contentStatus === "ready" ? (
            <DrawingBoard sessionId={sessionId} projects={projects} />
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
      </DialogContent>
    </Dialog>
  );
}
