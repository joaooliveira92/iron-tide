import type { PendingTurnDto } from "../../../shared/turn-message-contract.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

export function PendingTurnRecoveryPrompt({
  pending,
  unavailable,
  onResume,
  onAbandon,
}: {
  readonly pending: PendingTurnDto | null;
  readonly unavailable: boolean;
  readonly onResume: () => void;
  readonly onAbandon: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent
        data-testid="pending-turn-prompt"
        aria-label={resolveMessage("ui.pendingTurn.label")}
      >
        <AlertDialogHeader>
          {unavailable ? (
            <>
              <AlertDialogTitle>
                {resolveMessage("ui.pendingTurn.unavailableTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="pending-unavailable">
                {resolveMessage("ui.pendingTurn.unavailableBody")}
              </AlertDialogDescription>
            </>
          ) : (
            <>
              <AlertDialogTitle>{resolveMessage("ui.pendingTurn.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {pending?.createdAt !== undefined
                  ? resolveMessage("ui.pendingTurn.bodyWithDate", {
                      createdAt: pending.createdAt,
                    })
                  : resolveMessage("ui.pendingTurn.body")}
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!unavailable && (
            <button
              type="button"
              data-testid="pending-resume"
              className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              onClick={onResume}
            >
              {resolveMessage("ui.pendingTurn.resume")}
            </button>
          )}
          <button
            type="button"
            data-testid="pending-abandon"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={onAbandon}
          >
            {resolveMessage("ui.pendingTurn.discard")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
