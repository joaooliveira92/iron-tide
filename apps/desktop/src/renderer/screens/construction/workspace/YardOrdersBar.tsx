import { useState } from "react";
import { RebuildShipDialog } from "../components/RebuildShipDialog.js";
import { YardBar } from "../components/index.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function YardOrdersBar({ variant }: { readonly variant: "bar" | "header" }) {
  const { sessionId } = useConstructionState();
  const { openOrderDialog, refresh, retryRequest } = useConstructionActions();
  const { selectedDesign, busy, requestOutcomeUnknown } = useConstructionMeta();
  const [rebuildOpen, setRebuildOpen] = useState(false);
  return (
    <>
      <YardBar
        variant={variant}
        design={selectedDesign}
        busy={busy}
        retryPending={requestOutcomeUnknown}
        onRetry={requestOutcomeUnknown ? retryRequest : undefined}
        onOrder={() => openOrderDialog()}
        onRebuild={() => setRebuildOpen(true)}
        onRefresh={refresh}
      />
      <RebuildShipDialog open={rebuildOpen} onOpenChange={setRebuildOpen} sessionId={sessionId} />
    </>
  );
}
