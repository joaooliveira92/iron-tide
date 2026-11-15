import { lazy, Suspense } from "react";

import { MonthlyResolutionLoading } from "../../components/MonthlyResolutionLoading.js";
import { useCampaignShellActions, useCampaignShellState } from "../CampaignShellContext.js";
import { DecisionDialog } from "./DecisionDialog.js";
import { OfferDialog } from "./OfferDialog.js";
import { PendingTurnRecoveryPrompt } from "./PendingTurnRecoveryPrompt.js";

const PlayerBattleScreen = lazy(() =>
  import("../../screens/battle/PlayerBattleScreen.js").then((module) => ({
    default: module.PlayerBattleScreen,
  })),
);

export function CampaignInterruptions() {
  const { campaign, interruption } = useCampaignShellState();
  const actions = useCampaignShellActions();
  if (campaign === null || interruption === null) return null;
  if (interruption.unavailable) {
    return (
      <PendingTurnRecoveryPrompt
        pending={interruption.pending}
        unavailable
        onResume={() => undefined}
        onAbandon={actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request === null) {
    return (
      <PendingTurnRecoveryPrompt
        pending={interruption.pending}
        unavailable={false}
        onResume={actions.advanceMonth}
        onAbandon={actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request.kind === "decision") {
    return (
      <DecisionDialog
        request={interruption.request}
        onAnswer={(optionId) => void actions.answerInterruption({ kind: "decision", optionId })}
        onAbandon={actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request.kind === "offer") {
    return (
      <OfferDialog
        request={interruption.request}
        onChoose={(choice) => void actions.answerInterruption({ kind: "offer", choice })}
        onAbandon={actions.abandonPendingTurn}
      />
    );
  }
  return (
    <Suspense fallback={<MonthlyResolutionLoading committing />}>
      <PlayerBattleScreen
        request={interruption.request}
        sessionId={campaign.sessionId}
        onSubmitResult={(outcome) =>
          void actions.answerInterruption({ kind: "battle-outcome", outcome })
        }
        onAbandon={actions.abandonPendingTurn}
      />
    </Suspense>
  );
}
