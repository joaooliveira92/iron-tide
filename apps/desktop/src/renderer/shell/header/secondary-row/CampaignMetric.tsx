import { Bell, DollarSign, Gauge, Landmark, TrendingUp, Wallet } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import { translate } from "../../../lib/strings.js";
import type { HeaderMetric, MetricIcon } from "../../site-header-state.js";

const METRIC_ICONS: Record<MetricIcon, typeof DollarSign> = {
  budget: DollarSign,
  prestige: Gauge,
  tension: TrendingUp,
  nation: Landmark,
  alerts: Bell,
  balance: Wallet,
};

export interface CampaignMetricProps {
  readonly metric: HeaderMetric;
}

export function CampaignMetric({ metric }: CampaignMetricProps) {
  const Icon = METRIC_ICONS[metric.icon];

  return (
    <div
      className={cn("flex items-center gap-1.5", metric.placeholder && "text-muted-foreground")}
      title={
        metric.placeholder
          ? `${metric.label} ${translate("shell.header.metric.notReported")}`
          : undefined
      }
    >
      <Icon className="h-3 w-3" />
      <span className="text-xs tabular-nums">
        <span className="text-muted-foreground">{metric.label}:</span> {metric.value}
      </span>
    </div>
  );
}
