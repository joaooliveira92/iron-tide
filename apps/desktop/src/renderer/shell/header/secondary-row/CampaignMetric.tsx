import { Gauge } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import { translate } from "../../../lib/strings.js";
import type { HeaderMetric, MetricIcon } from "../../site-header-state.js";

const METRIC_ICONS: Record<MetricIcon, typeof Gauge> = {
  prestige: Gauge,
};

export interface CampaignMetricProps {
  readonly metric: HeaderMetric;
}

export function CampaignMetric({ metric }: CampaignMetricProps) {
  const Icon = METRIC_ICONS[metric.icon];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        metric.placeholder && "text-muted-foreground",
        metric.alert === true && "font-semibold text-destructive",
      )}
      {...(metric.alert === true ? { role: "status", tabIndex: 0 } : {})}
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
