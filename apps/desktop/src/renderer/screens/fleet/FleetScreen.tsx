import { useCallback, useMemo } from "react";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import { Ship } from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { CollapsibleSection } from "../../components/shared/CollapsibleSection.js";
import { Badge } from "../../components/ui/badge.js";
import { Separator } from "../../components/ui/separator.js";
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
import { AreaOverviewTable } from "./components/AreaOverviewTable.js";
import { useFleetScreen } from "./hooks/useFleetScreen.js";
import { DivisionPicker } from "./components/DivisionPicker.js";
import { WorldMapPanel } from "../../components/world-map/WorldMapPanel.js";
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

  return (
    <div data-guided-target="fleet" className="space-y-6">
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
      <DivisionPicker
        rows={divisionRows}
        selectedDivisionId={selectedDivisionId}
        onSelectDivision={setSelectedDivisionId}
      />
      <Separator />
      <WorldMapPanel
        sessionId={sessionId}
        title="Fleet positions"
        focusAreaId={selectedDivision?.areaId ?? null}
        testId="fleet-map-panel"
      />
      <CollapsibleSection title="Area overview" testId="fleet-area-overview">
        <AreaOverviewTable rows={areaOverview} />
      </CollapsibleSection>
      <Separator />
      <FleetOrganizationSection sessionId={sessionId} />
      <Separator />
      <FleetStationSection sessionId={sessionId} />
      <Separator />
      <OrderSection
        destinations={reachableAreas}
        destinationAreaId={destinationAreaId}
        onDestinationChange={setDestinationAreaId}
        order={order}
        actions={orderActions}
        notice={state.notice}
      />
      <MovementCommandsTable rows={movementRows} />
      <Separator />
      <FleetReportSections sessionId={sessionId} />
    </div>
  );
}

export { FleetScreen };
