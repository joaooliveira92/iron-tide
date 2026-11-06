import { memo } from "react";
import { translate } from "../../../lib/strings.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { dockGauge, type DockFigures } from "../yard-workspace.js";
import { Peek, PeekRows } from "./Peek.js";

export interface DockGaugeProps {
  readonly economy: DockFigures;
  readonly className?: string;
}

export const DockGauge = memo(function DockGauge({ economy, className }: DockGaugeProps) {
  const format = usePresentationFormat();
  const gauge = dockGauge(economy);
  const mass = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
  return (
    <Peek
      side="bottom"
      align="start"
      trigger={
        <div
          tabIndex={0}
          role="meter"
          aria-label={translate("construction.gauge.tonnageLimit")}
          aria-valuemin={0}
          aria-valuemax={gauge.capKg}
          aria-valuenow={gauge.usedKg}
          aria-valuetext={`${mass(gauge.usedKg)} of ${mass(gauge.capKg)}`}
          className={cn(
            "space-y-2 rounded-lg border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              {translate("construction.gauge.underConstruction")}
            </p>
            <p
              className={cn(
                "font-mono text-xs tabular-nums",
                gauge.over ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <span className="text-sm font-semibold text-foreground">{mass(gauge.usedKg)}</span> of{" "}
              {mass(gauge.capKg)}
            </p>
          </div>
          <div className="relative h-3 rounded-sm bg-muted">
            <div
              className={cn(
                "h-full rounded-sm transition-[width] duration-500 ease-out",
                gauge.over ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${gauge.usedPct}%` }}
            />
            {gauge.hullPct !== null && (
              <div
                aria-hidden="true"
                className="absolute -inset-y-1 w-px bg-foreground/60"
                style={{ left: `${gauge.hullPct}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{mass(gauge.freeKg)} free</span>
            {gauge.hullPct !== null && economy.dockMaxBuildDisplacementKg !== null && (
              <span>Largest hull {mass(economy.dockMaxBuildDisplacementKg)}</span>
            )}
          </div>
        </div>
      }
    >
      <PeekRows
        title={translate("construction.gauge.underConstructionAtOnce")}
        rows={[
          { label: translate("construction.gauge.underConstruction"), value: mass(gauge.usedKg) },
          { label: translate("construction.gauge.exemptSmallCraft"), value: mass(gauge.exemptKg) },
          { label: translate("construction.gauge.tonnageLimit"), value: mass(gauge.capKg) },
          { label: "Room left", value: mass(gauge.freeKg) },
        ]}
        note="The tick marks the largest single hull your dock can take, on the same scale."
      />
    </Peek>
  );
});
