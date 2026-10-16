import type { InterruptionRequestDto } from "../../../shared/campaign-command-contract.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

export type BattleChoice = "accept" | "decline" | "delegate";

/**
 * The battle-request modal (ticket 07, port only). The offer, accept/decline
 * rules, costs and force composition are T-1's policy; this substrate shows the
 * request and routes the player's choice back to the shell, which records a
 * validated battle result exactly once.
 */
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolveMessage(request.titleKey, request.interpolation)}
      data-testid="battle-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 className="text-sm font-semibold">
          {resolveMessage(request.titleKey, request.interpolation)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {resolveMessage(request.bodyKey, request.interpolation)}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="battle-accept"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("accept")}
          >
            Accept
          </button>
          <button
            type="button"
            data-testid="battle-decline"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("decline")}
          >
            Decline
          </button>
          <button
            type="button"
            data-testid="battle-delegate"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => onChoose("delegate")}
          >
            Delegate
          </button>
        </div>
        <button
          type="button"
          data-testid="battle-abandon"
          className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={onAbandon}
        >
          Abandon this turn
        </button>
      </div>
    </div>
  );
}
