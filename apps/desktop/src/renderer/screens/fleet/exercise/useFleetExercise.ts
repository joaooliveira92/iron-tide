import { useMemo, useState } from "react";
import { envelopeOf } from "../../../lib/command-envelope.js";
import type {
  FleetExerciseOutcome,
  FleetScreenProjection,
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
  explainExerciseRejection,
  exerciseRows,
  initialExerciseState,
  projectExercise,
  type ExerciseShipRow,
  type ExerciseState,
} from "./exercise-model.js";

export interface UseFleetExerciseReturn {
  readonly state: ExerciseState;
  readonly rows: readonly ExerciseShipRow[];
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly retry: () => void;
  readonly reload: () => void;
  readonly toggle: (shipId: string) => void;
  readonly hold: () => Promise<CommandOutcome>;
}

export function useFleetExercise(sessionId: string): UseFleetExerciseReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const [selection, setSelection] = useState<readonly string[]>([]);
  const workflow = useCommandScreenWorkflow<
    ExerciseState,
    FleetScreenProjection,
    FleetExerciseOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialExerciseState,
      load: () =>
        loadThroughBridge(bridge, (b) => b.campaign.execute("inspectFleetScreen", sessionId)),
      project: projectExercise,
      accept: (value) => ({
        patch: {},
        notice: `Fleet exercise queued for ${value.shipCount} ${value.shipCount === 1 ? "ship" : "ships"}. It is held the month after you advance.`,
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const rows = useMemo(() => exerciseRows(workflow.state.divisions), [workflow.state.divisions]);
  const selected = useMemo(
    () => selection.filter((id) => rows.some((row) => row.shipId === id && row.eligible)),
    [selection, rows],
  );

  const hold = (): Promise<CommandOutcome> => {
    if (!bridge || selected.length === 0) return Promise.resolve("transport-failure");
    const shipIds = [...selected];
    return workflow
      .execute("hold-exercise", async (stamp) => {
        const result = await bridge.campaign.execute("submitFleetExercise", {
          ...envelopeOf(sessionId, stamp),
          shipIds,
        });
        if (result.outcome !== "rejected" || result.reason !== "FLEET_EXERCISE_REJECTED") {
          return result;
        }
        return { ...result, diagnostics: explainExerciseRejection(result.diagnostics, rows) };
      })
      .then((outcome) => {
        if (outcome === "accepted") setSelection([]);
        return outcome;
      });
  };

  return {
    state: workflow.state,
    rows,
    selected,
    loadError: workflow.loadError,
    busy: workflow.state.pendingRequest !== null || workflow.state.requiresRefresh,
    outcomeUnknown: workflow.request.outcomeUnknown,
    retry: workflow.request.retry,
    reload: () => void workflow.loadScreen(),
    toggle: (shipId) =>
      setSelection((current) =>
        current.includes(shipId) ? current.filter((id) => id !== shipId) : [...current, shipId],
      ),
    hold,
  };
}
