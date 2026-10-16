import type { PendingTurnDto } from "../../../shared/campaign-command-contract.js";

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
      aria-label="Outstanding turn"
      data-testid="pending-turn-prompt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
        {unavailable ? (
          <>
            <h2 className="text-sm font-semibold">Outstanding turn cannot be resumed</h2>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="pending-unavailable">
              A saved turn could not be resumed against this campaign. Your save is unchanged. You
              can discard the outstanding turn and start the month fresh.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold">A month is outstanding</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This campaign has a turn waiting to be resolved
              {pending?.createdAt !== undefined ? ` (started ${pending.createdAt})` : ""}. Resume it
              or discard it to start fresh.
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
              Resume turn
            </button>
          )}
          <button
            type="button"
            data-testid="pending-abandon"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={onAbandon}
          >
            Discard outstanding turn
          </button>
        </div>
      </div>
    </div>
  );
}
