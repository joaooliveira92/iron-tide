import { useCallback, useMemo } from "react";
import {
  buildAreaOverview,
  divisionPickerRows,
  movementCommandRows,
  orderStatusView,
} from "../fleet-screen-state.js";
import type { UseFleetScreenReturn } from "./useFleetScreen.js";

export function useFleetOrderModel(screen: UseFleetScreenReturn) {
  const { state, selectedDivision, pendingRoute, request, loadScreen, submit, replace, cancel } =
    screen;
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
  const presenceView = useMemo(
    () => ({ warnings: state.presenceWarnings, areaName }),
    [state.presenceWarnings, areaName],
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
  return { areaOverview, presenceView, divisionRows, movementRows, order, orderActions };
}
