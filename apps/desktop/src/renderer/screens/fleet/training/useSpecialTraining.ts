import { envelopeOf } from "../../../lib/command-envelope.js";
import type {
  FleetScreenProjection,
  SpecialTrainingOutcome,
  TrainingSubjectId,
} from "../../../../shared/fleet-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { loadThroughBridge } from "../../../lib/bridge-read.js";
import {
  type CommandOutcome,
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
} from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { initialTrainingState, projectTraining, type TrainingState } from "./training-model.js";

export interface UseSpecialTrainingReturn {
  readonly state: TrainingState;
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly retry: () => void;
  readonly reload: () => void;
  readonly fund: (subjects: readonly TrainingSubjectId[]) => Promise<CommandOutcome>;
}

export function useSpecialTraining(sessionId: string): UseSpecialTrainingReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    TrainingState,
    FleetScreenProjection,
    SpecialTrainingOutcome
  >(
    requestLifecycleAdapter({
      initialState: initialTrainingState,
      load: () =>
        loadThroughBridge(bridge, (b) => b.campaign.execute("inspectFleetScreen", sessionId)),
      project: projectTraining,
      accept: (value) => ({
        patch: {},
        notice:
          value.subjects.length === 0
            ? "Special training will stop when you advance the month; progress is lost."
            : "Special training queued. It takes effect when you advance the month.",
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const fund = (subjects: readonly TrainingSubjectId[]): Promise<CommandOutcome> => {
    if (!bridge) return Promise.resolve("transport-failure");
    return workflow.execute("set-training", (stamp) =>
      bridge.campaign.execute("submitSpecialTraining", {
        ...envelopeOf(sessionId, stamp),
        subjects: [...subjects],
      }),
    );
  };

  return {
    state: workflow.state,
    loadError: workflow.loadError,
    busy: workflow.state.pendingRequest !== null || workflow.state.requiresRefresh,
    outcomeUnknown: workflow.request.outcomeUnknown,
    retry: workflow.request.retry,
    reload: () => void workflow.loadScreen(),
    fund,
  };
}
