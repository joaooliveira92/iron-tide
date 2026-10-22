import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
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
        <button
          type="button"
          data-testid="battle-abandon"
          className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={onAbandon}
        >
          {resolveMessage("ui.interruption.abandon")}
        </button>
      </div>
    </div>
  );
}
