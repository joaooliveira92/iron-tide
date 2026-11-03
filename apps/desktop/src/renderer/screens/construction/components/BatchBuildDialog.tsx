import { memo } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import {
  BatchBuildActions,
  BatchBuildContent,
  BatchBuildFields,
  BatchBuildHeader,
  BatchBuildNotice,
  BatchBuildRoot,
  BatchBuilderField,
  BatchDesignField,
  BatchQuantityField,
  ForeignYardBatchPreview,
  OwnYardBatchPreview,
} from "./batch-build/index.js";

export const BatchBuild = {
  Root: BatchBuildRoot,
  Header: BatchBuildHeader,
  Content: BatchBuildContent,
  Fields: BatchBuildFields,
  DesignField: BatchDesignField,
  BuilderField: BatchBuilderField,
  QuantityField: BatchQuantityField,
  OwnYardPreview: OwnYardBatchPreview,
  ForeignYardPreview: ForeignYardBatchPreview,
  Notice: BatchBuildNotice,
  Actions: BatchBuildActions,
} as const;

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
  const quantityInRange = Number.isInteger(quantity) && quantity >= 1 && quantity <= 12;
  const isForeign = builderNationId !== null;
  const foreign = foreignPreview !== null && foreignPreview.ok ? foreignPreview.preview : null;
  const foreignReady = foreign?.contract?.capabilitySatisfied === true;
  const canConfirm =
    !busy && quantityInRange && (isForeign ? foreignReady : preview !== null && preview.ok);
  const builders = foreign?.builders ?? [];

  return (
    <BatchBuild.Root>
      <BatchBuild.Header />
      <BatchBuild.Content>
        <BatchBuild.Fields>
          <BatchBuild.DesignField
            designs={designs}
            value={selectedDesignId}
            onChange={onSelectDesign}
          />
          <BatchBuild.BuilderField
            builders={builders}
            value={builderNationId}
            onChange={onSelectBuilder}
          />
          <BatchBuild.QuantityField value={quantity} onChange={onQuantityChange} />
        </BatchBuild.Fields>

        {isForeign && builderNationId !== null ? (
          <BatchBuild.ForeignYardPreview
            preview={foreignPreview}
            builderNationId={builderNationId}
          />
        ) : (
          <BatchBuild.OwnYardPreview preview={preview} />
        )}

        <BatchBuild.Notice notice={notice} />
        <BatchBuild.Actions
          canConfirm={canConfirm}
          confirmLabel={isForeign ? "Order from foreign yard" : "Confirm batch"}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </BatchBuild.Content>
    </BatchBuild.Root>
  );
});
