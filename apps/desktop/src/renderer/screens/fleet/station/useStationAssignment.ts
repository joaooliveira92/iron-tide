import { useCallback, useMemo, useState } from "react";
import type {
  FleetScreenProjection,
  StationAssignmentIntent,
  StationAssignmentOutcome,
} from "../../../../shared/fleet-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { loadThroughBridge } from "../../../lib/bridge-read.js";
import {
  type CommandOutcome,
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
} from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import {
  explainStationRejection,
  format,
  pruneSelection,
  stationRows,
  toggleSelection,
  type StationRow,
} from "./fleet-station-state.js";
import type { FleetStationState } from "./fleet-station-model.js";
import { initialFleetStationState, projectFleetStation } from "./fleet-station-model.js";

export interface UseStationAssignmentReturn {
  readonly state: FleetStationState;
  readonly rows: readonly StationRow[];
  readonly areaName: (areaId: string) => string;
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly request: {
    readonly outcomeUnknown: boolean;
    readonly retry: () => void;
  };
  readonly loadScreen: () => Promise<void>;
  readonly toggle: (shipId: string) => void;
  readonly send: (intent: StationAssignmentIntent) => Promise<CommandOutcome>;
}

export function useStationAssignment(sessionId: string): UseStationAssignmentReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const [selection, setSelection] = useState<readonly string[]>([]);
  const workflow = useCommandScreenWorkflow<
    FleetStationState,
    FleetScreenProjection,
    StationAssignmentOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialFleetStationState,
      load: () =>
        loadThroughBridge(bridge, (b) => b.campaign.execute("inspectFleetScreen", sessionId)),
      project: projectFleetStation,
      accept: (value) => ({
        patch: {},
        notice: format(`fleet.station.queued.${value.intent}`, {
          n: value.shipCount,
        }),
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const state = workflow.state;
  const areaName = useCallback(
    (areaId: string) => state.areas.find((area) => area.id === areaId)?.name ?? areaId,
    [state.areas],
  );
  const rows = useMemo(() => stationRows(state.divisions, areaName), [state.divisions, areaName]);
  const selected = useMemo(() => pruneSelection(selection, rows), [selection, rows]);

  const send = (intent: StationAssignmentIntent): Promise<CommandOutcome> => {
    if (!bridge || selected.length === 0) return Promise.resolve("transport-failure");
    const shipIds = [...selected];
    return workflow
      .execute(intent === "assign" ? "assign-station" : "clear-station", async (context) => {
        const result = await bridge.campaign.execute("submitStationAssignment", {
          sessionId,
          expectedRevision: context.expectedRevision,
          transportRequestId: context.transportRequestId,
          intent,
          shipIds,
        });
        if (result.outcome !== "rejected" || result.reason !== "STATION_ASSIGNMENT_REJECTED") {
          return result;
        }
        return {
          ...result,
          diagnostics: explainStationRejection(intent, result.diagnostics, rows),
        };
      })
      .then((outcome) => {
        if (outcome === "accepted") setSelection([]);
        return outcome;
      });
  };

  return {
    state,
    rows,
    areaName,
    selected,
    loadError: workflow.loadError,
    busy: state.pendingRequest !== null || state.requiresRefresh,
    request: workflow.request,
    loadScreen: workflow.loadScreen,
    toggle: (shipId) => setSelection((current) => toggleSelection(current, shipId)),
    send,
  };
}
