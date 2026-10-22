import { Button } from "../../../components/ui/button.js";

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
