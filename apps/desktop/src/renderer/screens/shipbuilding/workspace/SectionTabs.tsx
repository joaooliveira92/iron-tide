import { IndexTabs } from "../../../components/slate/IndexTabs.js";
import { designIndexTabs } from "../design-tabs.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function SectionTabs() {
  const { statuses } = useShipbuildingState();
  const { place, wide } = useShipbuildingMeta();
  const { openSection, closeDrawer } = useShipbuildingActions();
  return (
    <IndexTabs
      label="Design sections"
      testId="design-sections"
      groups={designIndexTabs(statuses)}
      openId={place?.section ?? null}
      onOpen={(id) => (place?.section === id ? closeDrawer() : openSection(id))}
      attached={wide}
    />
  );
}
