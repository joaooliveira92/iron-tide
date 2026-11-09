import { memo, useMemo, useState } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { cn } from "../../../lib/utils.js";
import type {
  ConstructionScreenProjection,
  ConstructionStudyEntry,
} from "../../../../shared/construction-contract.js";
import {
  CATALOG_SORTS,
  catalogShipTypes,
  catalogView,
  designFit,
  type CatalogSort,
} from "../yard-workspace.js";
import { DesignTile } from "./DesignTile.js";

export interface CatalogStageProps {
  readonly designs: readonly CompiledDesignVersion[];
  readonly economy: ConstructionScreenProjection["economy"];
  readonly workspace: ConstructionScreenProjection["workspace"];
  readonly studies: readonly ConstructionStudyEntry[];
  readonly selectedDesignId: string | null;
  readonly onSelectDesign: (designId: string) => void;
  readonly onOpenStudy: (designVersionId: string) => void;
}

const CHIP =
  "rounded-full border px-2.5 py-1 text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary/60 aria-pressed:bg-accent aria-pressed:font-medium";

export const CatalogStage = memo(function CatalogStage({
  designs,
  economy,
  workspace,
  studies,
  selectedDesignId,
  onSelectDesign,
  onOpenStudy,
}: CatalogStageProps) {
  const [shipType, setShipType] = useState<string | null>(null);
  const [sort, setSort] = useState<CatalogSort>("year");
  const types = useMemo(() => catalogShipTypes(designs), [designs]);
  const visible = useMemo(() => catalogView(designs, shipType, sort), [designs, shipType, sort]);
  const tiles = useMemo(
    () => visible.map((design) => ({ design, fit: designFit(design, economy, workspace) })),
    [visible, economy, workspace],
  );

  if (designs.length === 0 && studies.length === 0) {
    return (
      <Empty>
        <EmptyIcon />
        <EmptyTitle>No approved designs</EmptyTitle>
        <EmptyDescription>No approved design is available for this campaign.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Catalog filters" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={shipType === null}
          className={CHIP}
          onClick={() => setShipType(null)}
        >
          All types
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={shipType === type}
            className={cn(CHIP, "capitalize")}
            onClick={() => setShipType(type)}
          >
            {type}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort</span>
          <select
            aria-label="Sort designs"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            value={sort}
            onChange={(event) => setSort(event.target.value as CatalogSort)}
          >
            {CATALOG_SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        role="radiogroup"
        aria-label="Approved designs"
        className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3"
      >
        {tiles.map(({ design, fit }) => (
          <DesignTile
            key={design.designId}
            design={design}
            fit={fit}
            selected={design.designId === selectedDesignId}
            onSelect={onSelectDesign}
          />
        ))}
      </div>
      {studies.length > 0 && (
        <div role="group" aria-label="Designs in study" className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">In design study</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {studies.map((study) => (
              <button
                key={study.designStudyId}
                type="button"
                aria-label={`${study.className}, in design study, ready ${study.readyMonth}`}
                className="flex flex-col items-start gap-1 rounded-md border border-dashed p-3 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onOpenStudy(study.designVersionId)}
              >
                <span className="font-medium">{study.className}</span>
                <span className="text-xs text-muted-foreground">
                  {study.monthsRemaining} {study.monthsRemaining === 1 ? "month" : "months"} of
                  study left, ready {study.readyMonth}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
