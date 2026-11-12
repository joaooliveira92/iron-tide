import type { PlayerBattleResultDto } from "../../../shared/player-battle-contract.js";
import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
} from "../../components/ui/alert-dialog.js";
import { BattleBoard } from "./BattleBoard.js";
import { BattleHeader } from "./BattleHeader.js";
import { BattleSessionProvider } from "./session/BattleSession.js";

export function PlayerBattleScreen({
  request,
  sessionId,
  onSubmitResult,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly sessionId: string;
  readonly onSubmitResult: (result: PlayerBattleResultDto) => void;
  readonly onAbandon: () => void;
}) {
  return (
    <BattleSessionProvider
      sessionId={sessionId}
      battleId={request.battleId ?? ""}
      areaId={request.areaId}
      onSubmitResult={onSubmitResult}
    >
      <AlertDialog open onOpenChange={() => undefined}>
        <AlertDialogContent
          size="standard"
          aria-label="Tactical battle"
          data-testid="player-battle"
        >
          <AlertDialogBody>
            <BattleHeader onAbandon={onAbandon} />
            <BattleBoard />
          </AlertDialogBody>
        </AlertDialogContent>
      </AlertDialog>
    </BattleSessionProvider>
  );
}
