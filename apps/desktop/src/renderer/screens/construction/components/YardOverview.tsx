import { memo } from "react";
import { Banknote, Coins, Hammer, Layers, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Meter } from "./Meter.js";

export interface YardOverviewProps {
  readonly economy: {
    readonly treasury: number;
    readonly monthlyAppropriation: number;
    readonly shipyardCapacity: number;
  };
  readonly workspace: {
    readonly treasuryReserved: number;
    readonly capacityReserved: number;
  };
}

function Figure({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border p-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Commitment({
  icon: Icon,
  label,
  reserved,
  total,
  render,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly reserved: number;
  readonly total: number;
  readonly render: (value: number) => string;
}) {
  const format = usePresentationFormat();
  const pct = total > 0 ? Math.min(100, (reserved / total) * 100) : 0;
  const over = reserved > total;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
        <span className={cn("font-mono tabular-nums", over && "text-destructive")}>
          {render(reserved)} / {render(total)}
        </span>
      </div>
      <Meter pct={pct} tone={over ? "bad" : pct >= 85 ? "warn" : "primary"} />
      <p className="text-right text-xs text-muted-foreground">
        {format.number(pct, { maximumFractionDigits: 1 })}% committed ·{" "}
        {render(Math.max(0, total - reserved))} available
      </p>
    </div>
  );
}

export const YardOverview = memo(function YardOverview({ economy, workspace }: YardOverviewProps) {
  const format = usePresentationFormat();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <Figure icon={Banknote} label="Treasury" value={format.money(economy.treasury)} />
        <Figure
          icon={Coins}
          label="Monthly appropriation"
          value={format.money(economy.monthlyAppropriation)}
        />
        <Figure
          icon={Hammer}
          label="Shipyard capacity"
          value={format.count(economy.shipyardCapacity)}
        />
      </div>
      <section className="space-y-4" aria-label="Commitments">
        <div>
          <h4 className="text-sm font-medium">Commitments</h4>
          <p className="text-xs text-muted-foreground">
            Treasury and drydock capacity committed to construction this month.
          </p>
        </div>
        <Commitment
          icon={Lock}
          label="Treasury committed"
          reserved={workspace.treasuryReserved}
          total={economy.treasury}
          render={format.money}
        />
        <Commitment
          icon={Layers}
          label="Capacity committed"
          reserved={workspace.capacityReserved}
          total={economy.shipyardCapacity}
          render={format.count}
        />
      </section>
    </div>
  );
});
