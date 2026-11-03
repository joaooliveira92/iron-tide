import { useCallback, useMemo, useState } from "react";
import type { StrategicMapView } from "@bluewave/campaign-engine";
import { useBridge } from "../../lib/bridge-context.js";
import { loadThroughBridge } from "../../lib/bridge-read.js";
import {
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
  type CommandOutcome,
} from "../../lib/command-screen-workflow.js";
import { useMovementOrders } from "../../lib/movement-orders.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";
import type {
  FleetScreenProjection,
  MovementCommandOutcome,
} from "../../../shared/fleet-contract.js";
import type { PlayerProjectionPresence } from "../../../shared/fleet-contract.js";
import {
  acceptMovementCommand,
  initialFleetScreenState,
  projectFleetScreen,
  type FleetScreenState,
} from "../fleet/fleet-screen-state.js";
import { useWorldMapController } from "../../components/world-map/useWorldMapController.js";
import type {
  MapOrderDestination,
  MapOrderFleet,
  MapOrders,
} from "../../components/world-map/map-orders.js";
import { resolveDrop, type DropResolution } from "../../components/world-map/map-orders.js";
import { blockadedMapAreas, orderFleets, pendingOrders } from "./strategic-map-orders.js";

export interface StrategicMapScreenState {
  readonly map: ReturnType<typeof useWorldMapController>;
  readonly strategic: StrategicMapView | null;
  readonly presence: PlayerProjectionPresence | null;
  readonly orders: MapOrders;
  readonly selectedFleet: MapOrderFleet | null;
  readonly choices: readonly MapOrderDestination[];
  readonly notice: string | null;
  readonly noticeKind: "status" | "alert";
  readonly loadError: string | null;
  readonly loading: boolean;
  readonly selectFleet: (fleetId: string) => void;
  readonly orderTo: (fleetId: string, areaId: string) => void;
  readonly chooseDestination: (areaId: string) => void;
  readonly cancelChoice: () => void;
  readonly cancelOrder: (commandId: string) => void;
  readonly retry: () => void;
}

export function useStrategicMapScreen(sessionId: string): StrategicMapScreenState {
  const bridge = useBridge();
  const revision = useCampaignRevision();
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const map = useWorldMapController(sessionId, revision, refreshToken);
  const [choices, setChoices] = useState<readonly MapOrderDestination[]>([]);
  const [lastOutcome, setLastOutcome] = useState<CommandOutcome | null>(null);

  const workflow = useCommandScreenWorkflow<
    FleetScreenState,
    FleetScreenProjection,
    MovementCommandOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialFleetScreenState,
      load: () =>
        loadThroughBridge(bridge, (b) => b.campaign.execute("inspectFleetScreen", sessionId)),
      project: projectFleetScreen,
      accept: acceptMovementCommand,
    }),
    { refreshKey: revision },
  );
  const { state: fleetState, execute, loadError, loadScreen } = workflow;

  const areaNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const area of map.overlay.campaignAreas ?? []) names.set(area.id, area.name);
    return names;
  }, [map.overlay.campaignAreas]);

  const fleets = useMemo(() => orderFleets(map.strategic, areaNames), [map.strategic, areaNames]);
  const fleetById = useMemo(() => new Map(fleets.map((fleet) => [fleet.fleetId, fleet])), [fleets]);
  const pending = useMemo(
    () => pendingOrders(fleetState.movementCommands, fleets),
    [fleetState.movementCommands, fleets],
  );
  const blockadedAreas = useMemo(() => blockadedMapAreas(map.strategic), [map.strategic]);

  const orders = useMovementOrders(sessionId, execute);

  const selectedFleet = useMemo(
    () => (selectedFleetId === null ? null : (fleetById.get(selectedFleetId) ?? null)),
    [fleetById, selectedFleetId],
  );

  const selectFleet = useCallback((fleetId: string) => {
    setSelectedFleetId((current) => (current === fleetId ? null : fleetId));
    setChoices([]);
  }, []);

  const orderTo = useCallback(
    (fleetId: string, areaId: string) => {
      const fleet = fleetById.get(fleetId);
      if (fleet === undefined) return;
      const target = { divisionId: fleetId, fromAreaId: fleet.areaId, toAreaId: areaId };
      const existing = pending.find((order) => order.fleetId === fleetId);
      setLastOutcome(null);
      setChoices([]);
      void (
        existing === undefined ? orders.submit(target) : orders.replace(target, existing.commandId)
      ).then(setLastOutcome);
    },
    [fleetById, orders, pending],
  );

  const onDrop = useCallback(
    (fleetId: string, mapAreaId: string) => {
      const resolution: DropResolution = resolveDrop(fleetById.get(fleetId), mapAreaId);
      setSelectedFleetId(fleetId);
      if (resolution.kind === "ignored") {
        setChoices([]);
        return;
      }
      if (resolution.kind === "choose") {
        setChoices(resolution.destinations);
        return;
      }
      orderTo(fleetId, resolution.destination.areaId);
    },
    [fleetById, orderTo],
  );

  const chooseDestination = useCallback(
    (areaId: string) => {
      if (selectedFleetId === null) return;
      orderTo(selectedFleetId, areaId);
    },
    [orderTo, selectedFleetId],
  );

  const cancelOrder = useCallback(
    (commandId: string) => {
      setLastOutcome(null);
      void orders.cancel(commandId).then(setLastOutcome);
    },
    [orders],
  );

  const cancelChoice = useCallback(() => setChoices([]), []);

  const retry = useCallback(() => {
    setRefreshToken((token) => token + 1);
    void loadScreen();
  }, [loadScreen]);

  const mapOrders = useMemo<MapOrders>(
    () => ({
      fleets,
      pending,
      blockadedMapAreas: blockadedAreas,
      selectedFleetId,
      onSelectFleet: selectFleet,
      onDrop,
    }),
    [blockadedAreas, fleets, onDrop, pending, selectFleet, selectedFleetId],
  );

  const notice = fleetState.notice;
  const noticeKind =
    lastOutcome === null || lastOutcome === "accepted" ? ("status" as const) : ("alert" as const);

  return {
    map,
    strategic: map.strategic,
    presence: fleetState.presence,
    orders: mapOrders,
    selectedFleet,
    choices,
    notice,
    noticeKind,
    loadError: loadError ?? map.reason,
    loading: map.status === "loading" || fleetState.month === null,
    selectFleet,
    orderTo,
    chooseDestination,
    cancelChoice,
    cancelOrder,
    retry,
  };
}
