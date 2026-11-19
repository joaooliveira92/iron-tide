import { useState } from "react";
import { useLifecycle } from "../../../lib/use-lifecycle.js";
import { useMinWidth } from "../../../lib/use-min-width.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../../overview/hooks/useOverviewModel.js";
import type { FleetDepartment } from "../fleet-departments.js";
import { divisionIdForShip } from "../fleet-screen-state.js";
import type { LoadFleetInspection } from "./useFleetInspection.js";
import { useFleetOrderHotkeys } from "./useFleetOrderHotkeys.js";
import { useFleetOrderModel } from "./useFleetOrderModel.js";
import { useFleetScreen, type UseFleetScreenReturn } from "./useFleetScreen.js";

type OrderModel = ReturnType<typeof useFleetOrderModel>;

export interface FleetWorkspace {
  readonly status: "ready";
  readonly screen: UseFleetScreenReturn;
  readonly playerNationId: string;
  readonly model: OrderModel;
  readonly wide: boolean;
  readonly department: FleetDepartment | null;
  readonly preferredFlagshipId: string | null;
  readonly toggleDepartment: (id: FleetDepartment) => void;
  readonly closeDepartment: () => void;
}

export type FleetWorkspaceResult =
  | { readonly status: "error"; readonly message: string; readonly reload: () => void }
  | { readonly status: "loading" }
  | FleetWorkspace;

export function useFleetWorkspace(
  sessionId: string,
  load: LoadFleetInspection,
  focusShipId: string | null,
  onFocusHandled: (() => void) | undefined,
): FleetWorkspaceResult {
  const screen = useFleetScreen(sessionId, load);
  const { state, loadError, setSelectedDivisionId, loadScreen } = screen;
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const [department, setDepartment] = useState<FleetDepartment | null>(null);
  const [preferredFlagshipId, setPreferredFlagshipId] = useState<string | null>(null);

  const loadedForFocus = state.playerNationId !== null;
  useLifecycle(() => {
    if (focusShipId === null || !loadedForFocus) return;
    const divisionId = divisionIdForShip(focusShipId, state.divisions);
    if (divisionId !== null) setSelectedDivisionId(divisionId);
    setPreferredFlagshipId(focusShipId);
    setDepartment("organization");
    onFocusHandled?.();
  }, [focusShipId, loadedForFocus, state.divisions, setSelectedDivisionId, onFocusHandled]);

  const model = useFleetOrderModel(screen);
  useFleetOrderHotkeys(screen, model.divisionRows, model.orderActions.busy);

  if (loadError !== null) {
    return { status: "error", message: loadError, reload: () => void loadScreen() };
  }
  if (state.playerNationId === null) return { status: "loading" };

  return {
    status: "ready",
    screen,
    playerNationId: state.playerNationId,
    model,
    wide,
    department,
    preferredFlagshipId,
    toggleDepartment: (id) => setDepartment(department === id ? null : id),
    closeDepartment: () => setDepartment(null),
  };
}
