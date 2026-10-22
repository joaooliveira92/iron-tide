import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Banknote, Coins, Hammer, Layers, Lock } from "lucide-react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Progress } from "../../../components/ui/progress.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";

export interface StatsPanelProps {
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

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <GlassCard>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-mono text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </GlassCard>
  );
}

function UtilizationBar({
  icon: Icon,
  label,
  reserved,
  total,
  renderValue,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly reserved: number;
  readonly total: number;
  readonly renderValue: (value: number) => string;
}) {
  const format = usePresentationFormat();
  const pct = total > 0 ? Math.min(100, Math.round((reserved / total) * 1000) / 10) : 0;
  const overCommitted = reserved > total;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
        <span className={`font-mono ${overCommitted ? "text-destructive" : "text-foreground"}`}>
          {renderValue(reserved)} / {renderValue(total)}
        </span>
      </div>
      <Progress value={pct} className={overCommitted ? "[&>*>*]:bg-destructive" : undefined} />
      <p className="text-right text-xs text-muted-foreground">
        {format.number(pct, { maximumFractionDigits: 1 })}% committed ·{" "}
        {renderValue(Math.max(0, total - reserved))} available
      </p>
    </div>
  );
}

export const StatsPanel = memo(function StatsPanel({ economy, workspace }: StatsPanelProps) {
  const format = usePresentationFormat();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={Banknote} label="Treasury" value={format.money(economy.treasury)} />
        <KpiCard
          icon={Coins}
          label="Monthly Appropriation"
          value={format.money(economy.monthlyAppropriation)}
        />
        <KpiCard
          icon={Hammer}
          label="Shipyard Capacity"
          value={format.count(economy.shipyardCapacity)}
        />
      </div>
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Commitments</CardTitle>
          <CardDescription>
            Treasury and drydock capacity committed to construction this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <UtilizationBar
            icon={Lock}
            label="Treasury Committed"
            reserved={workspace.treasuryReserved}
            total={economy.treasury}
            renderValue={format.money}
          />
          <UtilizationBar
            icon={Layers}
            label="Capacity Committed"
            reserved={workspace.capacityReserved}
            total={economy.shipyardCapacity}
            renderValue={format.count}
          />
        </CardContent>
      </GlassCard>
    </div>
  );
});
