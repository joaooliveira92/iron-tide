import { useCallback, useRef } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import { loadThroughBridge } from "../../../lib/bridge-read.js";

import type {
  DiplomacyCommandOutcome,
  DiplomacyScreenProjection,
} from "../../../../shared/diplomacy-contract.js";
import { useCommandScreenWorkflow } from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { DiplomacyScreenState } from "../diplomacy-screen-state.js";
import {
  diplomacyBeginAction,
  diplomacyBeginPeace,
  diplomacyBeginSubmit,
  diplomacyClearDraft,
  diplomacyDraftToCommand,
  diplomacyLoadSuccess,
  diplomacySetBlockadeArea,
  diplomacySubmitRejected,
  diplomacySubmitSuccess,
  diplomacyTransportFailure,
  initialDiplomacyScreenState,
  type DiplomacyActionKind,
} from "../diplomacy-screen-state.js";

export interface UseDiplomacyScreenReturn {
  readonly state: DiplomacyScreenState;
  readonly loadError: string | null;
  readonly setRowAction: (partnerNationId: string, kind: DiplomacyActionKind) => void;
  readonly setPeaceAction: (warId: string) => void;
  readonly setBlockadeArea: (areaId: string) => void;
  readonly clearDraft: () => void;
  readonly submit: () => void;
  readonly reload: () => Promise<void>;
  readonly canSubmit: boolean;
}

export function useDiplomacyScreen(sessionId: string): UseDiplomacyScreenReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    DiplomacyScreenState,
    DiplomacyScreenProjection,
    DiplomacyCommandOutcome
  >(
    {
      initialState: initialDiplomacyScreenState,
      load: () =>
        loadThroughBridge(bridge, (b) => b.campaign.execute("inspectDiplomacyScreen", sessionId)),
      project: (_state, projection) => diplomacyLoadSuccess(projection),
      begin: (state, pending) => diplomacyBeginSubmit(state, pending.transportRequestId),
      reject: diplomacySubmitRejected,
      transportFailure: diplomacyTransportFailure,
      accept: diplomacySubmitSuccess,
      requiresRefresh: (state) => state.kind === "rejected-with-revision",
    },
    { refreshKey: campaignRevision },
  );
  const { state, execute, loadScreen, updateState } = workflow;
  const stateRef = useRef(state);
  stateRef.current = state;

  const setRowAction = useCallback(
    (partnerNationId: string, kind: DiplomacyActionKind) => {
      updateState((current) => diplomacyBeginAction(current, partnerNationId, kind));
    },
    [updateState],
  );

  const setPeaceAction = useCallback(
    (warId: string) => {
      updateState((current) => {
        if (current.kind !== "loaded" && current.kind !== "submitted") return current;
        const war = current.projection.wars.find((w) => w.warId === warId);
        if (!war) return current;
        return diplomacyBeginPeace(current, war);
      });
    },
    [updateState],
  );

  const setBlockadeArea = useCallback(
    (areaId: string) => {
      updateState((current) => diplomacySetBlockadeArea(current, areaId));
    },
    [updateState],
  );

  const clearDraft = useCallback(() => {
    updateState((current) => diplomacyClearDraft(current));
  }, [updateState]);

  const submit = useCallback(() => {
    const current = stateRef.current;
    if (current.kind !== "loaded" && current.kind !== "submitted") return;
    const draft = current.draftCommand;
    if (!draft || !bridge) return;
    const command = diplomacyDraftToCommand(draft);
    if (command === null) return;
    void execute("submit", ({ expectedRevision, transportRequestId }) =>
      bridge.campaign.execute("submitDiplomacyCommand", {
        sessionId,
        expectedRevision,
        transportRequestId,
        command,
      }),
    );
  }, [bridge, execute, sessionId]);

  const canSubmit =
    state.kind === "loaded" &&
    state.draftCommand !== null &&
    diplomacyDraftToCommand(state.draftCommand) !== null;

  return {
    state,
    loadError: workflow.loadError,
    setRowAction,
    setPeaceAction,
    setBlockadeArea,
    clearDraft,
    submit,
    reload: loadScreen,
    canSubmit,
  };
}
