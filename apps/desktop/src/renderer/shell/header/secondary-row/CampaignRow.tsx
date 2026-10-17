import { Separator } from "../../../components/ui/separator.js";
import { translate } from "../../../lib/strings.js";
import type { CampaignRowModel } from "../../site-header-state.js";
import { NO_DRAG } from "../drag-region.js";
import { CampaignMetric } from "./CampaignMetric.js";

export interface CampaignRowProps {
  readonly row: CampaignRowModel;
}

/** The active-campaign readout: projected metrics on the left, campaign status on the right. */
export function CampaignRow({ row }: CampaignRowProps) {
  return (
    <div className="flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        {row.metrics
          // Slots the engine does not report yet are omitted, not shown as "—".
          .filter((metric) => !metric.placeholder)
          .map((metric, index) => (
            <div key={metric.icon} className="flex items-center gap-4">
              {index > 0 && <Separator orientation="vertical" className="h-3" />}
              <CampaignMetric metric={metric} />
            </div>
          ))}
      </div>
      <div className="text-[12px]" style={NO_DRAG}>
        <span>
          {translate("shell.header.status.prefix")} <span>{row.status}</span>
        </span>
      </div>
    </div>
  );
}
