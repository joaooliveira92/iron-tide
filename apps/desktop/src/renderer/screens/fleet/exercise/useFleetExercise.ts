import { useCallback, useMemo, useState } from "react";
import { envelopeOf } from "../../../lib/command-envelope.js";
import type {
  FleetExerciseOutcome,
  FleetScreenProjection,
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
  const load = useFleetInspectionLoader(sessionId);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const workflow = useCommandScreenWorkflow<
    ExerciseState,
    FleetScreenProjection,
    FleetExerciseOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialExerciseState,
      load,
      project: projectExercise,
      accept: (value) => ({
        patch: {},
        notice: `Fleet exercise queued for ${value.shipCount} ${value.shipCount === 1 ? "ship" : "ships"}. It is held the month after you advance.`,
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const rows = useMemo(() => exerciseRows(workflow.state.divisions), [workflow.state.divisions]);
  const selected = useMemo(() => {
    const eligibleIds = new Set(rows.filter((row) => row.eligible).map((row) => row.shipId));
    return selection.filter((id) => eligibleIds.has(id));
  }, [selection, rows]);
  const toggle = useCallback(
    (shipId: string) =>
      setSelection((current) =>
        current.includes(shipId) ? current.filter((id) => id !== shipId) : [...current, shipId],
      ),
    [],
  );

  const hold = useCallback((): Promise<CommandOutcome> => {
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
  }, [bridge, rows, selected, sessionId, workflow.execute]);

  const { loadScreen } = workflow;
  const reload = useCallback(() => void loadScreen(), [loadScreen]);

  return {
    state: workflow.state,
    rows,
    selected,
    loadError: workflow.loadError,
    busy: workflow.state.pendingRequest !== null || workflow.state.requiresRefresh,
    outcomeUnknown: workflow.request.outcomeUnknown,
    retry: workflow.request.retry,
    reload,
    toggle,
    hold,
  };
}
