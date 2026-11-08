import { useState } from "react";
import { RebuildShipDialog } from "../components/RebuildShipDialog.js";
import { YardBar } from "../components/index.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function YardOrdersBar({ variant }: { readonly variant: "bar" | "header" }) {
  const { screen, sessionId } = useConstructionState();
  const { openWizard, openBatch, refresh, retryRequest } = useConstructionActions();
  const { selectedDesign, busy, requestOutcomeUnknown } = useConstructionMeta();
  const [rebuildOpen, setRebuildOpen] = useState(false);
  return (
    <>
      <YardBar
        variant={variant}
        design={selectedDesign}
        designCount={screen.designs.length}
        busy={busy}
        retryPending={requestOutcomeUnknown}
        onRetry={requestOutcomeUnknown ? retryRequest : undefined}
        onSubmit={openWizard}
        onBatch={openBatch}
        onRebuild={() => setRebuildOpen(true)}
        onRefresh={refresh}
      />
      <RebuildShipDialog open={rebuildOpen} onOpenChange={setRebuildOpen} sessionId={sessionId} />
    </>
  );
}
