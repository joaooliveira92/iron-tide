import { Button } from "../../../components/ui/button.js";

/**
 * The page footer: Back, plus an optional line saying what the page is and where
 * the global continue action leads. The continue control itself is the shell's
 * single primary action, so there is exactly one.
 */
export function BriefingActions({
  backLabel,
  canGoBack,
  onBack,
  note,
}: {
  readonly backLabel: string;
  readonly canGoBack: boolean;
  readonly onBack: () => void;
  readonly note?: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="outline" onClick={onBack} disabled={!canGoBack}>
        {backLabel}
      </Button>
      {note !== undefined && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
