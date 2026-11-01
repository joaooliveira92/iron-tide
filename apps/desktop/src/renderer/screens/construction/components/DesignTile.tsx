import { memo } from "react";
import { Plane } from "lucide-react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { cn } from "../../../lib/utils.js";
import { humanizeId } from "../../../lib/humanize-id.js";
import { shipTypeIcon } from "../../../components/design-workspace/index.js";
import { KG_PER_TONNE } from "../../../lib/presentation-format/units.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { DesignFit } from "../yard-workspace.js";
import { Meter } from "./Meter.js";
import { Peek, PeekRows } from "./Peek.js";

const COST_BASIS_TEXT: Record<CompiledDesignVersion["costBasis"], string> = {
  design_cost_model: "priced by the ship-design cost model",
  displacement_formula: "construction_order_v1 · 1 per 100t",
};

export interface DesignTileProps {
  readonly design: CompiledDesignVersion;
  readonly fit: DesignFit;
  readonly selected: boolean;
  readonly onSelect: (designId: string) => void;
}

export function DesignSpecRows({
  design,
  fit,
}: {
  readonly design: CompiledDesignVersion;
  readonly fit: DesignFit;
}) {
  const format = usePresentationFormat();
  return (
    <PeekRows
      title={design.className}
      rows={[
        { label: "Type", value: design.shipType },
        { label: "Year", value: String(design.year) },
        {
          label: "Displacement",
          value: format.measurement(design.mass * KG_PER_TONNE, "mass", {
            maximumFractionDigits: 0,
          }),
        },
        { label: "Speed", value: `${design.speed}kt` },
        { label: "Machinery", value: humanizeId(design.machineryType) },
        ...(design.carrierAttributes === undefined
          ? []
          : [{ label: "Aircraft", value: String(design.carrierAttributes.aircraftCapacity) }]),
        { label: "Projected cost", value: format.money(design.projectedCost) },
        { label: "Capacity units", value: format.count(design.projectedCapacityUnits) },
        {
          label: "Treasury left after",
          value: format.money(fit.freeTreasury - design.projectedCost),
        },
      ]}
      note={`Cost ${COST_BASIS_TEXT[design.costBasis]}.${
        design.requiredTechnologyIds.length > 0
          ? ` Needs ${design.requiredTechnologyIds.map(humanizeId).join(", ")}.`
          : ""
      }`}
    />
  );
}

export const DesignTile = memo(function DesignTile({
  design,
  fit,
  selected,
  onSelect,
}: DesignTileProps) {
  const format = usePresentationFormat();
  const Icon = shipTypeIcon(design.shipType);
  return (
    <Peek
      side="right"
      align="start"
      className="w-80"
      trigger={
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={!design.available}
          onClick={() => onSelect(design.designId)}
          className={cn(
            "group flex w-full flex-col gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors",
            "hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-55",
            selected && "border-primary/70 bg-accent/50 ring-1 ring-primary/50",
          )}
        >
          <span className="flex items-start gap-2.5">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold leading-tight">{design.className}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {design.shipType} · {design.year}
              </span>
            </span>
            {design.carrierAttributes !== undefined && (
              <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
                <Plane aria-hidden="true" className="size-3.5" />
                {design.carrierAttributes.aircraftCapacity}
              </span>
            )}
          </span>

          <span className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
            <span>
              <span className="block text-muted-foreground">Size</span>
              {format.measurement(fit.massKg, "mass", { maximumFractionDigits: 0 })}
            </span>
            <span>
              <span className="block text-muted-foreground">Speed</span>
              {design.speed}kt
            </span>
            <span>
              <span className="block text-muted-foreground">Cost</span>
              <span className={cn(!fit.affordable && "text-destructive")}>
                {format.money(design.projectedCost)}
              </span>
            </span>
          </span>

          <span className="space-y-1.5">
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dock</span>
              <span className={cn(fit.overDock && "text-destructive")}>
                {fit.dockPct === null ? "no dock" : fit.overDock ? "too large" : "fits"}
              </span>
            </span>
            <Meter pct={fit.dockPct ?? 0} tone={fit.overDock ? "bad" : "primary"} />
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Treasury</span>
              <span className={cn(!fit.affordable && "text-destructive")}>
                {fit.affordable ? `${Math.round(fit.costPct)}% of free funds` : "cannot afford"}
              </span>
            </span>
            <Meter pct={fit.costPct} tone={fit.affordable ? "ok" : "bad"} />
          </span>

          {!design.available && (
            <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs">
              Not yet available
            </span>
          )}
        </button>
      }
    >
      <DesignSpecRows design={design} fit={fit} />
    </Peek>
  );
});
