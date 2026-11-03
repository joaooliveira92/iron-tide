import { Alert } from "../../../components/ui/alert.js";
import { DepartmentDrawer } from "../../../components/slate/DepartmentDrawer.js";
import { linkedEntities } from "../../../components/design-workspace/selection/navigation.js";
import { SelectionInspector } from "../../../components/design-workspace/selection/SelectionInspector.js";
import { DrawerBody } from "../components/DrawerBody.js";
import { DESIGN_SECTION_SUMMARY } from "../design-tabs.js";
import { SectionBody } from "./SectionBody.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function ShipDrawer() {
  const { editError, selection } = useShipbuildingState();
  const { place, section, tab, tabId, entityCtx, drawerBodyRef } = useShipbuildingMeta();
  const { closeDrawer, openSection, goTo, clearSelection } = useShipbuildingActions();
  if (place === null || section === null || tab === null || tabId === null) return null;
  return (
    <DepartmentDrawer
      title={section.label}
      summary={DESIGN_SECTION_SUMMARY[place.section]}
      width="narrow"
      testId="design-drawer"
      onClose={closeDrawer}
    >
      <DrawerBody
        title={section.label}
        tabs={section.tabs}
        tab={tabId}
        onTab={(next) => openSection(place.section, next)}
      >
        <div
          ref={drawerBodyRef}
          data-selection-scope=""
          className="space-y-3"
          onFocus={(e) => selection.setLinked(linkedEntities(e.target, entityCtx))}
          onBlur={(e) => {
            if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
              selection.setLinked([]);
          }}
        >
          <SelectionInspector ctx={entityCtx} onGoTo={goTo} onClear={clearSelection} />
          {editError !== null && <Alert variant="destructive">{editError}</Alert>}
          <SectionBody at={place} />
        </div>
      </DrawerBody>
    </DepartmentDrawer>
  );
}
