import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

export type BattleChoice = "accept" | "decline" | "delegate";

export function BattleRequestDialog({
  request,
  onChoose,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly onChoose: (choice: BattleChoice) => void;
  readonly onAbandon: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent data-testid="battle-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {resolveMessage(request.titleKey, request.interpolation)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {resolveMessage(request.bodyKey, request.interpolation)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="battle-accept"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("accept")}
          >
            {resolveMessage("ui.battle.accept")}
          </button>
          <button
            type="button"
            data-testid="battle-decline"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("decline")}
          >
            {resolveMessage("ui.battle.decline")}
          </button>
          <button
            type="button"
            data-testid="battle-delegate"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("delegate")}
          >
            {resolveMessage("ui.battle.delegate")}
          </button>
        </div>
        <AlertDialogFooter>
          <button
            type="button"
            data-testid="battle-abandon"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onAbandon}
          >
            {resolveMessage("ui.interruption.abandon")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
