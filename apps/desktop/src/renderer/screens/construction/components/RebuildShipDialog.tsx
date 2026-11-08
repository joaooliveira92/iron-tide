import { useState } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import {
  loadDrawingBoardContent,
  useDrawingBoardContentSource,
} from "../../../components/design-workspace/index.js";
import { designDraftFrom } from "../../../components/design-workspace/panels/RebuildPanel.js";
import { RebuildNote } from "../../../components/design-workspace/panels/rebuild/RebuildNote.js";
import {
  RebuildPanelBody,
  type RebuildHost,
} from "../../../components/design-workspace/panels/rebuild/RebuildPanelBody.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.js";

const BUILD_TAB_HOST: RebuildHost = {
  confirmStart: false,
  hideTitle: true,
  loadHint:
    "Load the ship's design and the rebuild check appears here. This dialog changes the design only through the Bulge action; other changes are made on the drawing board in Ship design.",
};

function RebuildShipBody({ sessionId }: { readonly sessionId: string }) {
  const status = useDrawingBoardContentSource();
  const [draft, setDraft] = useState<DesignDraft | null>(null);
  if (status !== "ready") {
    return (
      <RebuildNote>
        {status === "loading"
          ? "Loading the ship-building rules…"
          : "The ship-building rules could not be loaded."}
      </RebuildNote>
    );
  }
  return (
    <RebuildPanelBody
      sessionId={sessionId}
      draft={draft}
      rules={loadDrawingBoardContent().rebuild}
      onLoad={(loaded) => setDraft(designDraftFrom(loaded))}
      dirty={false}
      host={BUILD_TAB_HOST}
    />
  );
}

export function RebuildShipDialog({
  open,
  onOpenChange,
  sessionId,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sessionId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rebuild a ship</DialogTitle>
          <DialogDescription>
            Pick a completed ship, load its design and queue a rebuild. It appears on the slipways
            once queued.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <RebuildShipBody sessionId={sessionId} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
