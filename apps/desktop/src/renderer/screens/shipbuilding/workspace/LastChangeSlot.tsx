import { useEffect, useRef } from "react";
import { LastChangeStrip } from "../components/LastChangeStrip.js";
import type { DesignSectionId } from "../design-sections.js";
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
  const opened = useRef<DesignSectionId | null>(null);
  useEffect(() => {
    const own = opened.current === section;
    opened.current = null;
    if (!own) clearLastChange();
  }, [section, clearLastChange]);
  return (
    <LastChangeStrip
      change={lastChange}
      onOpenSection={(id) => {
        opened.current = id === section ? null : id;
        openSection(id);
      }}
      onDismiss={clearLastChange}
    />
  );
}
