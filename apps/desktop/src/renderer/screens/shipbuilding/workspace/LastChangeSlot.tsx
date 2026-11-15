import { useEffect } from "react";
import { LastChangeStrip } from "../components/LastChangeStrip.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function LastChangeSlot() {
  const { lastChange } = useShipbuildingState();
  const { place } = useShipbuildingMeta();
  const { clearLastChange, openSection } = useShipbuildingActions();
  const section = place?.section ?? null;
  useEffect(() => clearLastChange(), [section, clearLastChange]);
  return (
    <LastChangeStrip
      change={lastChange}
      onOpenSection={(id) => openSection(id)}
      onDismiss={clearLastChange}
    />
  );
}
