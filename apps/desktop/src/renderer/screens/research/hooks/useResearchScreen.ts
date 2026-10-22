import { useCallback, useRef } from "react";
import { useBridge } from "../../../lib/bridge-context.js";

import type {
  ResearchPriorityOutcome,
  ResearchScreenProjection,
} from "../../../../shared/research-contract.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { useCommandScreenWorkflow } from "../../../lib/command-screen-workflow.js";
import {
  draftIsSubmittable,
  draftToPriorities,
  setDraftWeight,
  type FieldWeightOption,
} from "../research-field-priorities.js";
import type { ResearchScreenState } from "../research-screen-state.js";
import {
  initialResearchScreenState,
  researchBeginSubmit,
  researchLoadSuccess,
  researchSubmitRejected,
  researchSubmitSuccess,
  researchTransportFailure,
} from "../research-screen-state.js";

export interface UseResearchScreenReturn {
  readonly state: ResearchScreenState;
  readonly loadError: string | null;
  readonly setFieldWeight: (fieldId: string, weight: FieldWeightOption) => void;
  readonly submit: () => void;
  readonly reload: () => Promise<void>;
  readonly canSubmit: boolean;
}

export function useResearchScreen(sessionId: string): UseResearchScreenReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    ResearchScreenState,
    ResearchScreenProjection,
    ResearchPriorityOutcome
  >(
    {
      initialState: initialResearchScreenState,
      load: () =>
        bridge
          ? bridge.campaign.execute("inspectResearchScreen", sessionId)
          : Promise.reject(new Error("Bluewave bridge not available")),
      project: (_state, projection) => researchLoadSuccess(projection),
      begin: (state, pending) => researchBeginSubmit(state, pending.transportRequestId),
      reject: researchSubmitRejected,
      transportFailure: researchTransportFailure,
      accept: researchSubmitSuccess,
      requiresRefresh: (state) => state.kind === "rejected-with-revision",
    },
    { refreshKey: campaignRevision },
  );
  const { state, execute, loadScreen, updateState } = workflow;
  const stateRef = useRef(state);
  stateRef.current = state;

  const setFieldWeight = useCallback(
    (fieldId: string, weight: FieldWeightOption) => {
      updateState((current) => {
        if (
          current.kind !== "loaded" &&
          current.kind !== "submitted" &&
          current.kind !== "rejected-with-revision"
        ) {
          return current;
        }
        return { ...current, draft: setDraftWeight(current.draft, fieldId, weight), notice: null };
      });
    },
    [updateState],
  );

  const submit = useCallback(() => {
    const current = stateRef.current;
    if (current.kind !== "loaded" && current.kind !== "submitted") return;
    if (!bridge || !draftIsSubmittable(current.draft)) return;
    const fieldPriorities = draftToPriorities(current.draft);
    void execute("submit", ({ expectedRevision, transportRequestId }) =>
      bridge.campaign.execute("setResearchPriorityCommand", {
        sessionId,
        expectedRevision,
        transportRequestId,
        fieldPriorities,
      }),
    );
  }, [bridge, execute, sessionId]);

  const canSubmit = state.kind === "loaded" && draftIsSubmittable(state.draft);

  return {
    state,
    loadError: workflow.loadError,
    setFieldWeight,
    submit,
    reload: loadScreen,
    canSubmit,
  };
}
