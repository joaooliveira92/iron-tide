import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import { Ship } from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Badge } from "../../components/ui/badge.js";
import {
  buildAreaOverview,
  divisionPickerRows,
  movementCommandRows,
  orderStatusView,
} from "./fleet-screen-state.js";
import { FleetReportSections } from "./components/FleetReportSections.js";
import { MovementCommandsTable } from "./components/MovementCommandsTable.js";
import { OrderSection } from "./components/OrderSection.js";
import { FleetOrganizationSection } from "./organization/FleetOrganizationSection.js";
import { FleetStationSection } from "./station/FleetStationSection.js";
import { FleetExerciseSection } from "./exercise/FleetExerciseSection.js";
import { FleetTrainingSection } from "./training/FleetTrainingSection.js";
import { AreaOverviewTable } from "./components/AreaOverviewTable.js";
import { orderHotkeyIntent, stepDivisionSelection } from "./fleet-hotkeys.js";
import { useFleetHotkeys } from "./hooks/useFleetHotkeys.js";
import { useFleetScreen } from "./hooks/useFleetScreen.js";
import { translate } from "../../lib/strings.js";
import { ChartDesk, INDEX_TABS_CLEARANCE } from "../../components/slate/ChartDesk.js";
import { DepartmentDrawer } from "../../components/slate/DepartmentDrawer.js";
import { IndexTabs } from "../../components/slate/IndexTabs.js";
import { DivisionPicker } from "./components/DivisionPicker.js";
import { FleetMap } from "./components/FleetMap.js";
import { FleetRoster } from "./components/FleetRoster.js";
import { fleetDepartmentMeta, fleetIndexTabs, type FleetDepartment } from "./fleet-departments.js";
import { useMinWidth } from "../../lib/use-min-width.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../overview/hooks/useOverviewModel.js";
import { LoadErrorCard } from "./components/LoadErrorCard.js";
import { LoadingState } from "./components/LoadingState.js";

function FleetScreen({ sessionId }: { readonly sessionId: string }) {
  const {
    state,
    loadError,
    selectedDivisionId,
    selectedDivision,
    pendingRoute,
    destinationAreaId,
    reachableAreas,
    request,
    loadScreen,
    setSelectedDivisionId,
    setDestinationAreaId,
    submit,
    replace,
    cancel,
  } = useFleetScreen(sessionId);
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const [department, setDepartment] = useState<FleetDepartment | null>(null);

  const areaNameMap = useMemo(() => new Map(state.areas.map((a) => [a.id, a.name])), [state.areas]);
  const divisionNameMap = useMemo(
    () => new Map(state.divisions.map((d) => [d.divisionId, d.fleetName])),
    [state.divisions],
  );

  const areaOverview = useMemo(
    () => buildAreaOverview(state.areas, state.areaEdges, state.ports, state.divisions),
    [state.areas, state.areaEdges, state.ports, state.divisions],
  );

  const areaName = useCallback(
    (areaId: string) => areaNameMap.get(areaId) ?? areaId,
    [areaNameMap],
  );
  const divisionName = useCallback(
    (divisionId: string) => divisionNameMap.get(divisionId) ?? divisionId,
    [divisionNameMap],
  );

  const divisionRows = useMemo(
    () => divisionPickerRows(state.divisions, areaName),
    [state.divisions, areaName],
  );
  const movementRows = useMemo(
    () => movementCommandRows(state.movementCommands, areaName, divisionName),
    [state.movementCommands, areaName, divisionName],
  );
  const orderStatus = useMemo(
    () => orderStatusView(selectedDivision, pendingRoute, areaName),
    [selectedDivision, pendingRoute, areaName],
  );
  const order = useMemo(() => ({ status: orderStatus, pendingRoute }), [orderStatus, pendingRoute]);
  const orderActions = useMemo(
    () => ({
      busy: state.pendingRequest !== null || state.requiresRefresh,
      hasPendingRequest: request.outcomeUnknown,
      onSubmit: submit,
      onReplace: replace,
      onCancel: cancel,
      onRefresh: () => void loadScreen(),
      onRetry: request.retry,
    }),
    [
      state.pendingRequest,
      state.requiresRefresh,
      request.outcomeUnknown,
      request.retry,
      submit,
      replace,
      cancel,
      loadScreen,
    ],
  );

  const divisionIds = useMemo(() => divisionRows.map((row) => row.divisionId), [divisionRows]);
  const runOrderHotkey = useCallback(
    (action: "submit-order" | "cancel-order") => {
      const intent = orderHotkeyIntent(action, {
        busy: orderActions.busy,
        divisionSelected: selectedDivision !== null,
        destinationChosen: destinationAreaId !== null,
        pendingCommandId: pendingRoute?.commandId ?? null,
      });
      if (intent === null) return;
      if (intent.kind === "submit") submit();
      else if (intent.kind === "replace") replace(intent.commandId);
      else cancel(intent.commandId);
    },
    [orderActions.busy, selectedDivision, destinationAreaId, pendingRoute, submit, replace, cancel],
  );
  useFleetHotkeys({
    "previous-division": () =>
      setSelectedDivisionId((current) => stepDivisionSelection(divisionIds, current, -1)),
    "next-division": () =>
      setSelectedDivisionId((current) => stepDivisionSelection(divisionIds, current, 1)),
    "focus-destination": () =>
      document.querySelector<HTMLElement>("[data-fleet-destination]")?.focus(),
    "submit-order": () => runOrderHotkey("submit-order"),
    "cancel-order": () => runOrderHotkey("cancel-order"),
  });

  if (loadError !== null) {
    return (
      <div data-guided-target="fleet">
        <LoadErrorCard message={loadError} onReload={() => void loadScreen()} />
      </div>
    );
  }

  if (state.playerNationId === null) {
    return (
      <div data-guided-target="fleet">
        <LoadingState />
      </div>
    );
  }

  const stationsShort =
    state.presence === null || !state.presence.configured
      ? null
      : state.presence.areas.filter((area) => area.shortfallTons > 0).length;

  const roster = (
    <FleetRoster divisionCount={divisionRows.length} hint={translate("fleet.hotkeys.hint")}>
      <DivisionPicker
        rows={divisionRows}
        selectedDivisionId={selectedDivisionId}
        onSelectDivision={setSelectedDivisionId}
      />
    </FleetRoster>
  );

  const dispatch = (
    <OrderSection
      destinations={reachableAreas}
      destinationAreaId={destinationAreaId}
      onDestinationChange={setDestinationAreaId}
      order={order}
      actions={orderActions}
      notice={state.notice}
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
      onOpen={(id) => setDepartment(department === id ? null : id)}
      attached={wide}
    />
  );

  const panels: Readonly<Record<FleetDepartment, ReactNode>> = {
    organization: <FleetOrganizationSection sessionId={sessionId} />,
    station: <FleetStationSection sessionId={sessionId} />,
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
        onClose={() => setDepartment(null)}
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
          playerNationId={state.playerNationId}
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
          playerNationId={state.playerNationId}
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
