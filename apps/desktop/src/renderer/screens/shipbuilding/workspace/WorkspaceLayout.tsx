import type { CSSProperties } from "react";
import { PencilRuler } from "lucide-react";
import { ChartDesk, INDEX_TABS_CLEARANCE } from "../../../components/slate/ChartDesk.js";
import { ScreenHeader } from "../../../shell/screen-header.js";
import { DraftSaveWarning } from "../../../components/design-workspace/DraftSaveWarning.js";
import { CommandBarSection } from "./CommandBarSection.js";
import { SectionTabs } from "./SectionTabs.js";
import { ShipDrawer } from "./ShipDrawer.js";
import { StageSection } from "./StageSection.js";
import { StatusFoot } from "./StatusFoot.js";
import { WorkspaceDialogs } from "./WorkspaceDialogs.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

const DRAWER_WIDTH = "28rem";
const DRAWER_GAP = "0.75rem";

export function WorkspaceLayout() {
  const { autosave } = useShipbuildingState();
  const { wide, hosted, place, rootRef } = useShipbuildingMeta();
  const { onKeyDown, onKeyDownCapture } = useShipbuildingActions();
  const drawerClearance =
    place === null
      ? INDEX_TABS_CLEARANCE
      : `calc(${INDEX_TABS_CLEARANCE} + ${DRAWER_WIDTH} + ${DRAWER_GAP})`;
  return (
    <>
      <DraftSaveWarning visible={autosave.saveFailed} onDismiss={autosave.dismissSaveFailed} />
      {hosted ? (
        <ScreenHeader title="Ship design" icon={PencilRuler}>
          <CommandBarSection />
        </ScreenHeader>
      ) : null}
      {wide ? (
        <div
          ref={rootRef}
          data-testid="shipbuilding-workspace"
          data-guided-target="ship-design"
          className="relative h-full min-h-[28rem]"
          style={{ "--chrome-right": drawerClearance } as CSSProperties}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        >
          <h2 className="sr-only">Ship design</h2>
          <StageSection />
          <ChartDesk
            tabs={<SectionTabs />}
            drawer={<ShipDrawer />}
            slip={null}
            foot={<StatusFoot />}
          />
          {!hosted && (
            <div className="pointer-events-auto absolute inset-x-0 top-0 z-[10000]">
              <CommandBarSection />
            </div>
          )}
          <WorkspaceDialogs />
        </div>
      ) : (
        <div
          ref={rootRef}
          data-testid="shipbuilding-workspace"
          data-guided-target="ship-design"
          className="flex flex-col gap-3 p-3 pb-[calc(var(--chrome-bottom,0px)+0.75rem)] pt-[calc(var(--chrome-top,0px)+0.75rem)]"
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        >
          <h2 className="sr-only">Ship design</h2>
          {!hosted && <CommandBarSection />}
          <div
            className="relative h-[60vh] min-h-[22rem] overflow-hidden rounded-sm border border-admiralty-border"
            style={
              {
                "--chrome-top": "0px",
                "--chrome-bottom": "0px",
                "--chrome-slip": "0px",
                "--chrome-right": "1.5rem",
              } as CSSProperties
            }
          >
            <StageSection />
          </div>
          <div className="flex flex-col items-start gap-2">
            <StatusFoot />
          </div>
          <SectionTabs />
          {place !== null && (
            <div className="h-[70vh] min-h-[22rem]">
              <ShipDrawer />
            </div>
          )}
          <WorkspaceDialogs />
        </div>
      )}
    </>
  );
}
