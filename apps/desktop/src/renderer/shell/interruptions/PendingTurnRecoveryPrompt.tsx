import type { PendingTurnDto } from "../../../shared/campaign-command-contract.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

/**
 * The pending-turn recovery prompt (ticket 07). On load, a campaign that holds a
 * suspended turn prompts the player to resume it; an incompatible pending turn
 * is explained and resumption is declined **without altering the save**.
 */
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolveMessage("ui.pendingTurn.label")}
      data-testid="pending-turn-prompt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
        {unavailable ? (
          <>
            <h2 className="text-sm font-semibold">
              {resolveMessage("ui.pendingTurn.unavailableTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="pending-unavailable">
              {resolveMessage("ui.pendingTurn.unavailableBody")}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{resolveMessage("ui.pendingTurn.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {pending?.createdAt !== undefined
                ? resolveMessage("ui.pendingTurn.bodyWithDate", { createdAt: pending.createdAt })
                : resolveMessage("ui.pendingTurn.body")}
            </p>
          </>
        )}
        <div className="mt-3 flex gap-2">
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
        </div>
      </div>
    </div>
  );
}
