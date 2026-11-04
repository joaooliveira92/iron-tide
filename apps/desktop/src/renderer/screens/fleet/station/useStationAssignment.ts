import { useCallback, useMemo, useState } from "react";
import { envelopeOf } from "../../../lib/command-envelope.js";
import type {
  FleetScreenProjection,
  CommandableReadiness,
  ShipReadinessOutcome,
  StationAssignmentIntent,
  StationAssignmentOutcome,
} from "../../../../shared/fleet-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import {
  type CommandOutcome,
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
} from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { useFleetInspectionLoader } from "../hooks/useFleetInspection.js";
import {
  explainReadinessRejection,
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
  readonly sendReadiness: (readiness: CommandableReadiness) => Promise<CommandOutcome>;
}

export function useStationAssignment(sessionId: string): UseStationAssignmentReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const load = useFleetInspectionLoader(sessionId);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const workflow = useCommandScreenWorkflow<
    FleetStationState,
    FleetScreenProjection,
    StationAssignmentOutcome | ShipReadinessOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialFleetStationState,
      load,
      project: projectFleetStation,
      accept: (value) => ({
        patch: {},
        notice:
          "readiness" in value
            ? format("fleet.readiness.queued", {
                readiness: format(`fleet.readiness.state.${value.readiness}`),
                n: value.shipCount,
              })
            : format(`fleet.station.queued.${value.intent}`, {
                n: value.shipCount,
              }),
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const state = workflow.state;
  const areaNames = useMemo(
    () => new Map(state.areas.map((area) => [area.id, area.name] as const)),
    [state.areas],
  );
  const areaName = useCallback((areaId: string) => areaNames.get(areaId) ?? areaId, [areaNames]);
  const rows = useMemo(() => stationRows(state.divisions, areaName), [state.divisions, areaName]);
  const selected = useMemo(() => pruneSelection(selection, rows), [selection, rows]);

  const send = useCallback(
    (intent: StationAssignmentIntent): Promise<CommandOutcome> => {
      if (!bridge || selected.length === 0) return Promise.resolve("transport-failure");
      const shipIds = [...selected];
      return workflow
        .execute(intent === "assign" ? "assign-station" : "clear-station", async (stamp) => {
          const result = await bridge.campaign.execute("submitStationAssignment", {
            ...envelopeOf(sessionId, stamp),
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
    },
    [bridge, rows, selected, sessionId, workflow.execute],
  );

  const sendReadiness = useCallback(
    (readiness: CommandableReadiness): Promise<CommandOutcome> => {
      if (!bridge || selected.length === 0) return Promise.resolve("transport-failure");
      const shipIds = [...selected];
      return workflow
        .execute("set-readiness", async (stamp) => {
          const result = await bridge.campaign.execute("submitShipReadiness", {
            ...envelopeOf(sessionId, stamp),
            readiness,
            shipIds,
          });
          if (result.outcome !== "rejected" || result.reason !== "SHIP_READINESS_REJECTED") {
            return result;
          }
          return {
            ...result,
            diagnostics: explainReadinessRejection(result.diagnostics, rows),
          };
        })
        .then((outcome) => {
          if (outcome === "accepted") setSelection([]);
          return outcome;
        });
    },
    [bridge, rows, selected, sessionId, workflow.execute],
  );

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
    sendReadiness,
  };
}
