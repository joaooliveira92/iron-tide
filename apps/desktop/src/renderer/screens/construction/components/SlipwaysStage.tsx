import { memo } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { Progress } from "../../../components/ui/progress.js";
import { shipTypeIcon } from "../../../components/design-workspace/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import type { ProjectRow } from "../project-progress.js";
import { DockGauge } from "./DockGauge.js";
import { PackagePipeline } from "./PackagePipeline.js";
import { Peek, PeekRows } from "./Peek.js";
import { readoutLines } from "./ProjectReadout.js";
import { StatusChip } from "./StatusChip.js";

export interface SlipwaysStageProps {
  readonly rows: readonly ProjectRow[];
  readonly economy: ConstructionScreenProjection["economy"];
  readonly selectedId: string | null;
  readonly onSelect: (projectId: string) => void;
  readonly onBrowseCatalog: () => void;
}

const SlipLane = memo(function SlipLane({
  row,
  selected,
  onSelect,
}: {
  readonly row: ProjectRow;
  readonly selected: boolean;
  readonly onSelect: (projectId: string) => void;
}) {
  const format = usePresentationFormat();
  const Icon = shipTypeIcon(row.shipType);
  return (
    <li
      data-selected={selected}
      className={cn(
        "rounded-lg border bg-card transition-colors",
        selected ? "border-primary/60 ring-1 ring-primary/40" : "hover:border-foreground/25",
        row.status === "COMPLETED" && "opacity-70",
      )}
    >
      <Peek
        side="top"
        align="start"
        className="w-80"
        trigger={
          <button
            type="button"
            aria-pressed={selected}
            aria-label={`${row.className}, ${row.status.toLowerCase().replaceAll("_", " ")}, ${row.percent}%`}
            onClick={() => onSelect(row.projectId)}
            className="flex w-full items-center gap-3 rounded-t-lg p-3 text-left outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-tight">{row.className}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {row.shipType}
                {row.isForeign ? " · foreign yard" : ""}
              </span>
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {row.yard !== null && <Badge variant="outline">{row.yard}</Badge>}
              {row.holdUntilMonth !== null && (
                <Badge variant="secondary">on hold until {row.holdUntilMonth}</Badge>
              )}
              <StatusChip status={row.status} />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-lg font-semibold tabular-nums">
              {row.percent}%
            </span>
          </button>
        }
      >
        <PeekRows
          title={row.className}
          rows={readoutLines(row, format)}
          note="Select the ship to steer it."
        />
      </Peek>
      <div className="space-y-2 px-3 pb-3">
        <Progress value={row.percent} aria-label={`${row.className} progress`} />
        {row.packages.length > 0 && <PackagePipeline row={row} />}
      </div>
    </li>
  );
});

export const SlipwaysStage = memo(function SlipwaysStage({
  rows,
  economy,
  selectedId,
  onSelect,
  onBrowseCatalog,
}: SlipwaysStageProps) {
  return (
    <div className="space-y-3">
      <DockGauge economy={economy} />
      {rows.length === 0 ? (
        <Empty>
          <EmptyIcon />
          <EmptyTitle>No ships under construction</EmptyTitle>
          <EmptyDescription>Order a design from the Design Catalog.</EmptyDescription>
          <Button variant="outline" size="sm" onClick={onBrowseCatalog}>
            Browse the design catalog
          </Button>
        </Empty>
      ) : (
        <ul aria-label="Ships under construction" className="space-y-2">
          {rows.map((row) => (
            <SlipLane
              key={row.projectId}
              row={row}
              selected={row.projectId === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
});
