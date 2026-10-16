import type { InterruptionRequestDto } from "../../../shared/campaign-command-contract.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

/**
 * The blocking decision modal (ticket 07): a mandatory choice appears over the
 * campaign and must be answered before advancing. Each option shows qualitative
 * consequence hints (direction and rough magnitude) — never hidden
 * calculations. The modal owns no authoritative state; choosing calls back to
 * the shell, which records the answer and resumes.
 */
export function DecisionDialog({
  request,
  onAnswer,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly onAnswer: (optionId: string) => void;
  readonly onAbandon: () => void;
}) {
  const options = request.options ?? [];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolveMessage(request.titleKey, request.interpolation)}
      data-testid="decision-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 className="text-sm font-semibold">
          {resolveMessage(request.titleKey, request.interpolation)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {resolveMessage(request.bodyKey, request.interpolation)}
        </p>
        <ul className="mt-3 space-y-2">
          {options.map((option) => (
            <li key={option.optionId} className="rounded border border-border/60 p-2">
              <p className="text-xs font-medium">
                {resolveMessage(option.titleKey, request.interpolation)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {resolveMessage(option.bodyKey, request.interpolation)}
              </p>
              {option.hints.length > 0 && (
                <ul data-testid="decision-hints" className="mt-1 space-y-0.5">
                  {option.hints.map((hint, index) => (
                    <li key={index} className="text-[10px] text-muted-foreground">
                      {hint.target.id} {hint.attribute}: {hint.direction} ({hint.magnitude})
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                data-testid="decision-option"
                className="mt-2 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
                onClick={() => onAnswer(option.optionId)}
              >
                Choose
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-testid="decision-abandon"
          className="mt-3 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onAbandon}
        >
          Abandon this turn
        </button>
      </div>
    </div>
  );
}
