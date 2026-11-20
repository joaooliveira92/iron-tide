import type { CSSProperties, ReactNode } from "react";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import { Ship } from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Badge } from "../../components/ui/badge.js";
import { FleetReportSections } from "./components/FleetReportSections.js";
import { MovementCommandsTable } from "./components/MovementCommandsTable.js";
import { OrderSection } from "./components/OrderSection.js";
import { FleetOrganizationSection } from "./organization/FleetOrganizationSection.js";
import { FleetStationSection } from "./station/FleetStationSection.js";
import { FleetExerciseSection } from "./exercise/FleetExerciseSection.js";
import { FleetTrainingSection } from "./training/FleetTrainingSection.js";
import { FleetTradeSection } from "./trade/FleetTradeSection.js";
import { AreaOverviewTable } from "./components/AreaOverviewTable.js";
import { useFleetWorkspace, type FleetWorkspace } from "./hooks/useFleetWorkspace.js";
import {
  FleetInspectionContext,
  useFleetInspectionCache,
  type LoadFleetInspection,
} from "./hooks/useFleetInspection.js";
import { translate } from "../../lib/strings.js";
import { ChartDesk, INDEX_TABS_CLEARANCE } from "../../components/slate/ChartDesk.js";
import { DepartmentDrawer } from "../../components/slate/DepartmentDrawer.js";
import { IndexTabs } from "../../components/slate/IndexTabs.js";
import { DivisionPicker } from "./components/DivisionPicker.js";
import { FleetMap } from "./components/FleetMap.js";
import { FleetRoster } from "./components/FleetRoster.js";
import { fleetDepartmentMeta, fleetIndexTabs, type FleetDepartment } from "./fleet-departments.js";
import { LoadErrorCard } from "./components/LoadErrorCard.js";
import { LoadingState } from "./components/LoadingState.js";

interface FleetFocusProps {
  readonly focusShipId?: string | null;
  readonly onFocusHandled?: () => void;
}

function FleetScreen({
  sessionId,
  focusShipId = null,
  onFocusHandled,
}: { readonly sessionId: string } & FleetFocusProps) {
  const load = useFleetInspectionCache(sessionId);
  return (
    <FleetInspectionContext value={load}>
      <FleetScreenContent
        sessionId={sessionId}
        load={load}
        focusShipId={focusShipId}
        {...(onFocusHandled === undefined ? {} : { onFocusHandled })}
      />
    </FleetInspectionContext>
  );
}

function FleetScreenContent({
  sessionId,
  load,
  focusShipId,
  onFocusHandled,
}: {
  readonly sessionId: string;
  readonly load: LoadFleetInspection;
  readonly focusShipId: string | null;
  readonly onFocusHandled?: () => void;
}) {
  const workspace = useFleetWorkspace(sessionId, load, focusShipId, onFocusHandled);

  if (workspace.status === "error") {
    return (
      <div data-guided-target="fleet">
        <LoadErrorCard message={workspace.message} onReload={workspace.reload} />
      </div>
    );
  }

  if (workspace.status === "loading") {
    return (
      <div data-guided-target="fleet">
        <LoadingState />
      </div>
    );
  }

  return <FleetWorkspaceView sessionId={sessionId} workspace={workspace} />;
}

function FleetWorkspaceView({
  sessionId,
  workspace,
}: {
  readonly sessionId: string;
  readonly workspace: FleetWorkspace;
}) {
  const { screen, model, wide, department, preferredFlagshipId, playerNationId } = workspace;
  const { state, selectedDivisionId, selectedDivision } = screen;
  const { divisionRows, movementRows, areaOverview } = model;

  const stationsShort =
    state.presence === null || !state.presence.configured
      ? null
      : state.presence.areas.filter((area) => area.shortfallTons > 0).length;

  const roster = (
    <FleetRoster divisionCount={divisionRows.length} hint={translate("fleet.hotkeys.hint")}>
      <DivisionPicker
        rows={divisionRows}
        selectedDivisionId={selectedDivisionId}
        onSelectDivision={screen.setSelectedDivisionId}
      />
    </FleetRoster>
  );

  const dispatch = (
    <OrderSection
      destinations={screen.reachableAreas}
      destinationAreaId={screen.destinationAreaId}
      onDestinationChange={screen.setDestinationAreaId}
      order={model.order}
      actions={model.orderActions}
      notice={state.notice}
      presence={model.presenceView}
    />
  );

  const tabs = (
    <IndexTabs
      label="Fleet departments"
      testId="fleet-affairs"
      groups={fleetIndexTabs({
        divisions: divisionRows.length,
        orders: movementRows.length,
        areas: areaOverview.length,
        stationsShort,
      })}
      openId={department}
      onOpen={workspace.toggleDepartment}
      attached={wide}
    />
  );

  const panels: Readonly<Record<FleetDepartment, ReactNode>> = {
    organization: (
      <FleetOrganizationSection
        key={preferredFlagshipId ?? "none"}
        sessionId={sessionId}
        {...(preferredFlagshipId === null ? {} : { preferredFlagshipId })}
      />
    ),
    station: (
      <>
        <FleetStationSection sessionId={sessionId} />
        <FleetTradeSection sessionId={sessionId} />
      </>
    ),
    training: <FleetTrainingSection sessionId={sessionId} />,
    exercises: <FleetExerciseSection sessionId={sessionId} />,
    orders: <MovementCommandsTable compact rows={movementRows} />,
    areas: <AreaOverviewTable rows={areaOverview} />,
    reports: <FleetReportSections sessionId={sessionId} />,
  };

  const meta = department === null ? null : fleetDepartmentMeta(department);
  const drawer =
    department === null || meta === null ? null : (
      <DepartmentDrawer
        title={meta.label}
        summary={meta.summary}
        width={meta.width}
        testId="fleet-workbench"
        hotkeyScope
        onClose={workspace.closeDepartment}
      >
        <div className="space-y-4 [&>section]:border-t-0 [&>section]:pt-0">
          {panels[department]}
        </div>
      </DepartmentDrawer>
    );

  const focusAreaId = selectedDivision?.areaId ?? null;

  if (wide) {
    const drawerWidth = meta === null ? null : meta.width === "wide" ? "44rem" : "28rem";
    const clearance =
      drawerWidth === null
        ? INDEX_TABS_CLEARANCE
        : `calc(${INDEX_TABS_CLEARANCE} + ${drawerWidth} + 0.75rem)`;
    return (
      <div
        data-guided-target="fleet"
        className="relative h-full min-h-[28rem]"
        style={{ "--chrome-right": clearance } as CSSProperties}
      >
        <h2 className="sr-only">Fleet</h2>
        <FleetMap
          sessionId={sessionId}
          playerNationId={playerNationId}
          focusAreaId={focusAreaId}
          variant="command"
          leftPanels={roster}
        />
        <ChartDesk tabs={tabs} drawer={drawer} slip={dispatch} />
      </div>
    );
  }

  return (
    <div data-guided-target="fleet" className="flex flex-col gap-3 p-3">
      <PageHeader
        icon={Ship}
        title="Fleet"
        description={
          DEBUG_MODE && state.month !== null
            ? `${state.month.month}/${state.month.year}`
            : undefined
        }
        actions={
          DEBUG_MODE ? (
            <Badge variant="outline" className="font-mono text-xs">
              Rev {state.revision}
            </Badge>
          ) : undefined
        }
      />
      <div className="h-[60vh] min-h-[22rem]">
        <FleetMap
          sessionId={sessionId}
          playerNationId={playerNationId}
          focusAreaId={focusAreaId}
          variant="panel"
        />
      </div>
      {roster}
      {dispatch}
      {tabs}
      {drawer !== null && <div className="h-[70vh] min-h-[22rem]">{drawer}</div>}
    </div>
  );
}

export { FleetScreen };
