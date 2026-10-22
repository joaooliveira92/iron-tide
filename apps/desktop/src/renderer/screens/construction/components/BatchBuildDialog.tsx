import { memo } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { ForeignContractPanel } from "./ForeignContractPanel.js";

export interface BatchBuildDialogProps {
  readonly designs: readonly CompiledDesignVersion[];
  readonly selectedDesignId: string | null;
  readonly onSelectDesign: (designId: string) => void;
  readonly quantity: number;
  readonly onQuantityChange: (quantity: number) => void;
  readonly preview: ConstructionBatchPreviewOutcome | null;
  readonly foreignPreview: ForeignConstructionPreviewOutcome | null;
  readonly builderNationId: string | null;
  readonly onSelectBuilder: (nationId: string | null) => void;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export const BatchBuildDialog = memo(function BatchBuildDialog({
  designs,
  selectedDesignId,
  onSelectDesign,
  quantity,
  onQuantityChange,
  preview,
  foreignPreview,
  builderNationId,
  onSelectBuilder,
  busy,
  notice,
  onConfirm,
  onCancel,
}: BatchBuildDialogProps) {
  const format = usePresentationFormat();
  const quantityInRange = Number.isInteger(quantity) && quantity >= 1 && quantity <= 12;
  const isForeign = builderNationId !== null;
  const foreign = foreignPreview !== null && foreignPreview.ok ? foreignPreview.preview : null;
  const foreignContract = foreign?.contract ?? null;
  const foreignReady = foreignContract !== null && foreignContract.capabilitySatisfied;
  const canConfirm =
    !busy && quantityInRange && (isForeign ? foreignReady : preview !== null && preview.ok);
  const refused = !isForeign && preview !== null && !preview.ok;
  const shown = !isForeign && preview !== null && preview.ok ? preview.preview : null;
  const ceilingText =
    shown === null
      ? ""
      : shown.dockCeilingKg === null
        ? "no dock ceiling"
        : `${format.measurement(shown.dockCeilingKg, "mass", { maximumFractionDigits: 0 })} dock ceiling`;
  const builders = foreign?.builders ?? [];

  return (
    <Card data-testid="batch-build-dialog">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Order a class batch (1–12)</CardTitle>
        <CardDescription>
          One order places up to twelve hulls of one approved design; the engine assigns their
          names.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-0.5 text-xs text-muted-foreground">
            <span>Batch design</span>
            <select
              aria-label="Batch design"
              className="block h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
              value={selectedDesignId ?? ""}
              onChange={(event) => onSelectDesign(event.target.value)}
            >
              {designs.map((design) => (
                <option key={design.designId} value={design.designId}>
                  {design.className}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5 text-xs text-muted-foreground">
            <span>Builder</span>
            <select
              aria-label="Builder"
              className="block h-9 min-w-48 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
              value={builderNationId ?? ""}
              onChange={(event) =>
                onSelectBuilder(event.target.value === "" ? null : event.target.value)
              }
            >
              <option value="">Your own yards</option>
              {builders.map((builder) => (
                <option key={builder.nationId} value={builder.nationId}>
                  {builder.name}
                  {builder.capabilitySatisfied ? "" : " (unavailable)"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5 text-xs text-muted-foreground">
            <span>Quantity</span>
            <input
              aria-label="Batch quantity"
              className="block h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
              type="number"
              min={1}
              max={12}
              value={quantity}
              onChange={(event) => onQuantityChange(Number(event.target.value))}
            />
          </label>
        </div>

        {isForeign && foreign !== null && builderNationId !== null && (
          <ForeignContractPanel preview={foreign} builderNationId={builderNationId} />
        )}
        {isForeign && foreign === null && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking the foreign yard…
          </p>
        )}

        {shown !== null && (
          <div className="space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">
              Assigned names ({shown.names.length} of {shown.quantity})
            </p>
            <ul
              aria-label="Previewed ship names"
              className="list-inside list-disc font-mono text-sm"
            >
              {shown.names.map((allocation, index) => (
                <li key={`${allocation.name}-${String(index)}`}>{allocation.name}</li>
              ))}
            </ul>
            {shown.namePoolExhausted && (
              <p role="status" className="text-xs text-destructive">
                The name pool is exhausted: at least one hull takes a numbered variant of an
                existing name.
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

        {refused && preview !== null && (
          <Alert variant="destructive">
            <AlertDescription className="whitespace-pre-line">{preview.reason}</AlertDescription>
          </Alert>
        )}

        {notice !== null && (
          <Alert>
            <AlertDescription className="whitespace-pre-line">{notice}</AlertDescription>
          </Alert>
        )}

        <ButtonGroup>
          <Button data-testid="batch-confirm" onClick={onConfirm} disabled={!canConfirm} size="sm">
            {isForeign ? "Order from foreign yard" : "Confirm batch"}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Back to catalog
          </Button>
        </ButtonGroup>
      </CardContent>
    </Card>
  );
});
