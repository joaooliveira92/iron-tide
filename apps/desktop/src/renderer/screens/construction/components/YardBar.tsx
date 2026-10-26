import { Layers, RefreshCw, Send } from "lucide-react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { shipTypeIcon } from "../../../components/design-workspace/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Tip } from "../../../components/ui/tip.js";

export interface YardBarProps {
  readonly design: CompiledDesignVersion | null;
  readonly designCount: number;
  readonly busy: boolean;
  readonly retryPending: boolean;
  readonly onRetry: (() => void) | undefined;
  readonly onSubmit: () => void;
  readonly onBatch: () => void;
  readonly onRefresh: () => void;
}

export function YardBar({
  design,
  designCount,
  busy,
  retryPending,
  onRetry,
  onSubmit,
  onBatch,
  onRefresh,
}: YardBarProps) {
  const format = usePresentationFormat();
  const Icon = design === null ? null : shipTypeIcon(design.shipType);
  return (
    <div
      role="group"
      aria-label="Yard orders"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 basis-[22rem] items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">Next order</span>
        {design === null || Icon === null ? (
          <span className="text-sm text-muted-foreground">
            No design selected. Pick one in the catalog.
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{design.className}</span>
            <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">
              {format.money(design.projectedCost)}
            </span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {retryPending && onRetry !== undefined && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry Pending Request
          </Button>
        )}
        <ButtonGroup>
          <Button size="sm" onClick={onSubmit} disabled={busy || design === null}>
            <Send aria-hidden="true" />
            Submit Construction Command
          </Button>
          <Button variant="outline" size="sm" onClick={onBatch} disabled={designCount === 0}>
            <Layers aria-hidden="true" />
            Order a class batch (1–12)
          </Button>
        </ButtonGroup>
        <Tip label="Refresh">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Refresh"

            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </Tip>
      </div>
    </div>
  );
}
