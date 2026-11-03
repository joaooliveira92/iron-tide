import { YardBar } from "../components/index.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function YardOrdersBar({ variant }: { readonly variant: "bar" | "header" }) {
  const { screen } = useConstructionState();
  const { openWizard, openBatch, refresh, retryRequest } = useConstructionActions();
  const { selectedDesign, busy, requestOutcomeUnknown } = useConstructionMeta();
  return (
    <YardBar
      variant={variant}
      design={selectedDesign}
      designCount={screen.designs.length}
      busy={busy}
      retryPending={requestOutcomeUnknown}
      onRetry={requestOutcomeUnknown ? retryRequest : undefined}
      onSubmit={openWizard}
      onBatch={openBatch}
      onRefresh={refresh}
    />
  );
}
