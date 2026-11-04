import { lazy, Suspense } from "react";

import { MonthlyResolutionLoading } from "../../components/MonthlyResolutionLoading.js";
import { useCampaignShellContext } from "../CampaignShellContext.js";
import { DecisionDialog } from "./DecisionDialog.js";
import { OfferDialog } from "./OfferDialog.js";
import { PendingTurnRecoveryPrompt } from "./PendingTurnRecoveryPrompt.js";

const PlayerBattleScreen = lazy(() =>
  import("../../screens/battle/PlayerBattleScreen.js").then((module) => ({
    default: module.PlayerBattleScreen,
  })),
);

export function CampaignInterruptions() {
  const shell = useCampaignShellContext();
  const campaign = shell.state.campaign;
  const interruption = shell.state.interruption;
  if (campaign === null || interruption === null) return null;
  if (interruption.unavailable) {
    return (
      <PendingTurnRecoveryPrompt
        pending={interruption.pending}
        unavailable
        onResume={() => undefined}
        onAbandon={shell.actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request === null) {
    return (
      <PendingTurnRecoveryPrompt
        pending={interruption.pending}
        unavailable={false}
        onResume={shell.actions.advanceMonth}
        onAbandon={shell.actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request.kind === "decision") {
    return (
      <DecisionDialog
        request={interruption.request}
        onAnswer={(optionId) =>
          void shell.actions.answerInterruption({ kind: "decision", optionId })
        }
        onAbandon={shell.actions.abandonPendingTurn}
      />
    );
  }
  if (interruption.request.kind === "offer") {
    return (
      <OfferDialog
        request={interruption.request}
        onChoose={(choice) => void shell.actions.answerInterruption({ kind: "offer", choice })}
        onAbandon={shell.actions.abandonPendingTurn}
      />
    );
  }
  return (
    <Suspense fallback={<MonthlyResolutionLoading committing />}>
      <PlayerBattleScreen
        request={interruption.request}
        sessionId={campaign.sessionId}
        onSubmitResult={(outcome) =>
          void shell.actions.answerInterruption({ kind: "battle-outcome", outcome })
        }
        onAbandon={shell.actions.abandonPendingTurn}
      />
    </Suspense>
  );
}
