import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../../../shared/construction-contract.js";
import { Alert, AlertDescription } from "../../../../components/ui/alert.js";
import { Button } from "../../../../components/ui/button.js";
import { ButtonGroup } from "../../../../components/ui/button-group.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { ForeignContractPanel } from "../ForeignContractPanel.js";

export function BatchBuildNotice({ notice }: { readonly notice: string | null }) {
  if (notice === null) return null;
  return (
    <Alert>
      <AlertDescription className="whitespace-pre-line">{notice}</AlertDescription>
    </Alert>
  );
}

export function BatchBuildActions({
  canConfirm,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  readonly canConfirm: boolean;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ButtonGroup>
      <Button data-testid="batch-confirm" onClick={onConfirm} disabled={!canConfirm} size="sm">
        {confirmLabel}
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel}>
        Back to catalog
      </Button>
    </ButtonGroup>
  );
}

export function OwnYardBatchPreview({
  preview,
}: {
  readonly preview: ConstructionBatchPreviewOutcome | null;
}) {
  const format = usePresentationFormat();
  const shown = preview !== null && preview.ok ? preview.preview : null;
  const ceilingText =
    shown === null
      ? ""
      : shown.dockCeilingKg === null
        ? "no dock ceiling"
        : `${format.measurement(shown.dockCeilingKg, "mass", { maximumFractionDigits: 0 })} dock ceiling`;

  return (
    <>
      {shown !== null && (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">
            Assigned names ({shown.names.length} of {shown.quantity})
          </p>
          <ul aria-label="Previewed ship names" className="list-inside list-disc font-mono text-sm">
            {shown.names.map((allocation, index) => (
              <li key={`${allocation.name}-${String(index)}`}>{allocation.name}</li>
            ))}
          </ul>
          {shown.namePoolExhausted && (
            <p role="status" className="text-xs text-destructive">
              The name pool is exhausted: at least one hull takes a numbered variant of an existing
              name.
            </p>
          )}
        </div>
      )}

      {shown !== null && (
        <p data-testid="batch-fit" className="font-mono text-xs">
          Yard {shown.yardId ?? "not assigned"} ·{" "}
          {format.measurement(shown.designDisplacementKg, "mass", { maximumFractionDigits: 0 })}{" "}
          displacement vs {ceilingText} — {shown.fitsDock ? "fits" : "does not fit"}
        </p>
      )}

      {preview !== null && !preview.ok && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-line">{preview.reason}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

export function ForeignYardBatchPreview({
  preview,
  builderNationId,
}: {
  readonly preview: ForeignConstructionPreviewOutcome | null;
  readonly builderNationId: string;
}) {
  const foreign = preview !== null && preview.ok ? preview.preview : null;
  if (foreign !== null) {
    return <ForeignContractPanel preview={foreign} builderNationId={builderNationId} />;
  }
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Checking the foreign yard…
    </p>
  );
}
