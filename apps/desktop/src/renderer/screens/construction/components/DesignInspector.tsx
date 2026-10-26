import { memo } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import { designFit } from "../yard-workspace.js";
import { ConstructionWizard } from "./ConstructionWizard.js";
import { DesignSpecRows } from "./DesignTile.js";

export interface DesignInspectorProps {
  readonly tab: string;
  readonly design: CompiledDesignVersion | null;
  readonly economy: ConstructionScreenProjection["economy"];
  readonly workspace: ConstructionScreenProjection["workspace"];
  readonly busy: boolean;
  readonly notice: string | null;
  readonly onConfirm: () => void;
  readonly onBackToDesign: () => void;
}

export const DesignInspector = memo(function DesignInspector({
  tab,
  design,
  economy,
  workspace,
  busy,
  notice,
  onConfirm,
  onBackToDesign,
}: DesignInspectorProps) {
  if (tab === "order") {
    return (
      <ConstructionWizard
        design={design}
        economy={economy}
        workspace={workspace}
        busy={busy}
        notice={notice}
        onConfirm={onConfirm}
        onCancelWizard={onBackToDesign}
      />
    );
  }
  if (design === null) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Pick a design in the catalog to see how it sits against your dock and treasury.
      </p>
    );
  }
  const fit = designFit(design, economy, workspace);
  return (
    <div className="space-y-3">
      <DesignSpecRows design={design} fit={fit} />
      {fit.overDock && (
        <p role="note" className="text-xs text-destructive">
          This hull is larger than your dock can build.
        </p>
      )}
      {!fit.affordable && (
        <p role="note" className="text-xs text-destructive">
          The projected cost is more than the treasury has free this month.
        </p>
      )}
    </div>
  );
});
