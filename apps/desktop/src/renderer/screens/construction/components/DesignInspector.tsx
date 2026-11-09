import { memo } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import { Button } from "../../../components/ui/button.js";
import { designFit } from "../yard-workspace.js";
import { DesignSpecRows } from "./DesignTile.js";

export interface DesignInspectorProps {
  readonly design: CompiledDesignVersion | null;
  readonly economy: ConstructionScreenProjection["economy"];
  readonly workspace: ConstructionScreenProjection["workspace"];
  readonly busy: boolean;
  readonly onOrder: () => void;
}

export const DesignInspector = memo(function DesignInspector({
  design,
  economy,
  workspace,
  busy,
  onOrder,
}: DesignInspectorProps) {
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
      <Button size="sm" onClick={onOrder} disabled={busy}>
        Order this design
      </Button>
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
