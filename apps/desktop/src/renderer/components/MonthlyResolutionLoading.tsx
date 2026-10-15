import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";

export const RESOLUTION_STAGE_LABELS: readonly string[] = [
  "Reviewing naval finances",
  "Processing fleet maintenance",
  "Advancing ship construction",
  "Assessing foreign relations",
  "Reviewing research programs",
  "Compiling the naval estimates",
  "Saving the campaign",
] as const;

export interface MonthlyResolutionLoadingProps {
  readonly committing: boolean;
}

export function MonthlyResolutionLoading({ committing }: MonthlyResolutionLoadingProps) {
  if (!committing) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Preparing the Monthly Naval Estimates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            {RESOLUTION_STAGE_LABELS.map((label, idx) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                  {idx + 1}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Resolving the month — this is a cosmetic stage indicator over the synchronous commit; no
            percentage is claimed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MonthlyResolutionFailure({
  message,
  onReturn,
  onRetry,
}: {
  readonly message: string;
  readonly onReturn: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Could not advance month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{message}</p>
          <p className="text-xs text-muted-foreground">
            The previous month remains intact — no state was partially applied. The save pointer was
            not advanced.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onReturn}>
              Return to Overview
            </Button>
            <Button onClick={onRetry}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
