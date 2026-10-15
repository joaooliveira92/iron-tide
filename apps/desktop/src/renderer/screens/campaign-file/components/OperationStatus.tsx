import { X } from "lucide-react";

import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import type { OperationResult } from "../types.js";

interface OperationStatusProps {
  readonly pendingLabel: string | null;
  readonly result: OperationResult | null;
  readonly onDismiss: () => void;
}

export function OperationStatus({ pendingLabel, result, onDismiss }: OperationStatusProps) {
  return (
    <>
      {pendingLabel !== null ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{pendingLabel}</CardContent>
        </Card>
      ) : null}
      <OperationResultAlert result={result} onDismiss={onDismiss} />
    </>
  );
}

function OperationResultAlert({
  result,
  onDismiss,
}: {
  readonly result: OperationResult | null;
  readonly onDismiss: () => void;
}) {
  if (result === null) return null;

  if (result.kind === "error") {
    return (
      <Alert variant="destructive" className="flex items-start justify-between gap-2">
        <AlertDescription>{result.message}</AlertDescription>
        <DismissButton onDismiss={onDismiss} />
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="flex items-start justify-between gap-2">
      <AlertDescription>
        <OperationResultMessage result={result} />
      </AlertDescription>
      <DismissButton onDismiss={onDismiss} />
    </Alert>
  );
}

function OperationResultMessage({
  result,
}: {
  readonly result: Exclude<OperationResult, { kind: "error" }>;
}) {
  if (result.kind === "verify") {
    return (
      <span>
        Package verified — campaign{" "}
        <span className="font-mono">{result.response.campaignIdentity.slice(0, 12)}</span>, active
        revision <span className="font-mono">{result.response.activeRevision}</span>
      </span>
    );
  }

  if (result.kind === "replay") {
    return (
      <span>
        Replay complete — {result.response.revisions.length} revision
        {result.response.revisions.length !== 1 ? "s" : ""} verified
      </span>
    );
  }

  return (
    <span>
      Recovery{" "}
      {result.response.activeRevision !== null
        ? `complete — active revision ${result.response.activeRevision}`
        : "complete — no active revision found"}
    </span>
  );
}

function DismissButton({ onDismiss }: { readonly onDismiss: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="shrink-0"
    >
      <X />
    </Button>
  );
}
