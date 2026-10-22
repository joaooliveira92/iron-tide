import { useState } from "react";

import type {
  BudgetCommandOutcome,
  BudgetScreenProjection,
} from "../../../../shared/budget-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { useCommandScreenWorkflow } from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import {
  emptyDraft,
  resolveDraft,
  setDraftRate,
  setDraftResearch,
  type AllocationDraft,
} from "../budget-policy-draft.js";
import {
  acceptBudgetAllocation,
  initialBudgetPolicyState,
  projectBudgetPolicy,
  type BudgetPolicyState,
} from "../budget-policy-state.js";

export interface BudgetPolicyPanelController {
  readonly state: BudgetPolicyState;
  readonly loadError: string | null;
  readonly rate: number;
  readonly research: number;
  readonly setRate: (value: number) => void;
  readonly setResearch: (value: number) => void;
  readonly apply: () => void;
}

export function useBudgetPolicyPanel(sessionId: string): BudgetPolicyPanelController {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    BudgetPolicyState,
    BudgetScreenProjection,
    BudgetCommandOutcome
  >(
    {
      initialState: initialBudgetPolicyState,
      load: () =>
        bridge
          ? bridge.campaign.execute("inspectBudgetScreen", sessionId)
          : Promise.reject(new Error("Bluewave bridge not available")),
      project: projectBudgetPolicy,
      accept: acceptBudgetAllocation,
    },
    { refreshKey: campaignRevision },
  );
  const { state } = workflow;

  const [draft, setDraft] = useState<AllocationDraft>(() => emptyDraft(state.revision));
  const { current, rate, research } = resolveDraft(draft, state);

  function apply(): void {
    if (!bridge) return;
    void workflow.execute("submit", ({ expectedRevision, transportRequestId }) =>
      bridge.campaign.execute("submitBudgetAllocation", {
        sessionId,
        expectedRevision,
        transportRequestId,
        appropriationRateBp: rate,
        researchBudget: research,
      }),
    );
  }

  return {
    state,
    loadError: workflow.loadError,
    rate,
    research,
    setRate: (value) => setDraft(setDraftRate(current, value)),
    setResearch: (value) => setDraft(setDraftResearch(current, value)),
    apply,
  };
}
