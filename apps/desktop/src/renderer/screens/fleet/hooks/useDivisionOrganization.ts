import type {
  DivisionCommandBody,
  DivisionCommandOutcome,
  DivisionScreenProjection,
} from "../../../../shared/division-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import {
  type CommandOutcome,
  useCommandScreenWorkflow,
} from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { DivisionOrganizationState } from "../organization/division-organization-state.js";
import {
  acceptDivisionCommand,
  initialDivisionOrganizationState,
  projectDivisionOrganization,
} from "../organization/division-organization-state.js";

export interface UseDivisionOrganizationReturn {
  readonly state: DivisionOrganizationState;
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly request: { readonly outcomeUnknown: boolean; readonly retry: () => void };
  readonly loadScreen: () => Promise<void>;
  readonly send: (command: DivisionCommandBody) => Promise<CommandOutcome>;
}

export function useDivisionOrganization(sessionId: string): UseDivisionOrganizationReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    DivisionOrganizationState,
    DivisionScreenProjection,
    DivisionCommandOutcome
  >(
    {
      initialState: initialDivisionOrganizationState,
      load: () =>
        bridge
          ? bridge.campaign.execute("inspectDivisionScreen", sessionId)
          : Promise.reject(new Error("Bluewave bridge not available")),
      project: projectDivisionOrganization,
      accept: acceptDivisionCommand,
    },
    { refreshKey: campaignRevision },
  );

  function send(command: DivisionCommandBody): Promise<CommandOutcome> {
    if (!bridge) return Promise.resolve("transport-failure");
    return workflow.execute("submit", ({ expectedRevision, transportRequestId }) =>
      bridge.campaign.execute("submitDivisionCommand", {
        sessionId,
        expectedRevision,
        transportRequestId,
        command,
      }),
    );
  }

  const state = workflow.state;
  return {
    state,
    loadError: workflow.loadError,
    busy: state.pendingRequest !== null || state.requiresRefresh,
    request: workflow.request,
    loadScreen: workflow.loadScreen,
    send,
  };
}
