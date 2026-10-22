import { useCallback, useMemo, useState } from "react";
import type { MovementCommand } from "@bluewave/campaign-engine";
import { useBridge } from "../../../lib/bridge-context.js";
import { useMovementOrders } from "../../../lib/movement-orders.js";
import type {
  FleetDivisionView,
  FleetScreenProjection,
  MovementCommandOutcome,
} from "../../../../shared/fleet-contract.js";
import { useCommandScreenWorkflow } from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { FleetScreenState } from "../fleet-screen-state.js";
import {
  acceptMovementCommand,
  initialFleetScreenState,
  nextDivisionSelection,
  pendingRouteFor,
  projectFleetScreen,
  reachableAreas,
} from "../fleet-screen-state.js";

export interface UseFleetScreenReturn {
  readonly state: FleetScreenState;
  readonly loadError: string | null;
  readonly selectedDivisionId: string | null;
  readonly selectedDivision: FleetDivisionView | null;
  readonly pendingRoute: MovementCommand | null;
  readonly destinationAreaId: string | null;
  readonly reachableAreas: readonly { readonly id: string; readonly name: string }[];
  readonly request: {
    readonly outcomeUnknown: boolean;
    readonly retry: () => void;
  };
  readonly loadScreen: () => Promise<void>;
  readonly setSelectedDivisionId: React.Dispatch<React.SetStateAction<string | null>>;
  readonly setDestinationAreaId: React.Dispatch<React.SetStateAction<string | null>>;
  readonly submit: () => void;
  readonly replace: (commandId: string) => void;
  readonly cancel: (commandId: string) => void;
}

export function useFleetScreen(sessionId: string): UseFleetScreenReturn {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [destinationAreaId, setDestinationAreaId] = useState<string | null>(null);
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    FleetScreenState,
    FleetScreenProjection,
    MovementCommandOutcome
  >(
    {
      initialState: initialFleetScreenState,
      load: () =>
        bridge
          ? bridge.campaign.execute("inspectFleetScreen", sessionId)
          : Promise.reject(new Error("Bluewave bridge not available")),
      project: projectFleetScreen,
      accept: acceptMovementCommand,
      onProjection: (projection) => {
        setSelectedDivisionId((current) => nextDivisionSelection(current, projection.divisions));
        setDestinationAreaId((current) => current ?? projection.areas[0]?.id ?? null);
      },
    },
    { refreshKey: campaignRevision },
  );
  const { state, execute, loadScreen, loadError, request } = workflow;

  const selectedDivision = useMemo(
    () => state.divisions.find((division) => division.divisionId === selectedDivisionId) ?? null,
    [state.divisions, selectedDivisionId],
  );

  const reachable = useMemo(
    () =>
      selectedDivision === null
        ? []
        : reachableAreas(state.areas, state.areaEdges, selectedDivision.areaId),
    [state.areas, state.areaEdges, selectedDivision],
  );

  const effectiveDestinationAreaId = useMemo(
    () =>
      reachable.some((area) => area.id === destinationAreaId)
        ? destinationAreaId
        : (reachable[0]?.id ?? null),
    [reachable, destinationAreaId],
  );

  const pendingRoute = useMemo(
    () =>
      selectedDivisionId === null
        ? null
        : pendingRouteFor(state.movementCommands, selectedDivisionId),
    [state.movementCommands, selectedDivisionId],
  );

  const routeTarget = useMemo(() => {
    if (selectedDivision === null || effectiveDestinationAreaId === null) return null;
    return {
      divisionId: selectedDivision.divisionId,
      fromAreaId: selectedDivision.areaId,
      toAreaId: effectiveDestinationAreaId,
    };
  }, [selectedDivision, effectiveDestinationAreaId]);

  const orders = useMovementOrders(sessionId, execute);

  const submit = useCallback(() => {
    if (routeTarget === null) return;
    void orders.submit(routeTarget);
  }, [orders, routeTarget]);

  const replace = useCallback(
    (commandId: string) => {
      if (routeTarget === null) return;
      void orders.replace(routeTarget, commandId);
    },
    [orders, routeTarget],
  );

  const cancel = useCallback(
    (commandId: string) => {
      void orders.cancel(commandId);
    },
    [orders],
  );

  return {
    state,
    loadError,
    selectedDivisionId,
    selectedDivision,
    pendingRoute,
    destinationAreaId: effectiveDestinationAreaId,
    reachableAreas: reachable,
    request,
    loadScreen,
    setSelectedDivisionId,
    setDestinationAreaId,
    submit,
    replace,
    cancel,
  };
}
