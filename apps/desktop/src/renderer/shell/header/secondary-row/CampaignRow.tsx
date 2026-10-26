import { Separator } from "../../../components/ui/separator.js";
import { translate } from "../../../lib/strings.js";
import { useScreenHeaderSlot } from "../../screen-header.js";
import type { CampaignRowModel } from "../../site-header-state.js";
import { NO_DRAG } from "../drag-region.js";
import { CampaignMetric } from "./CampaignMetric.js";
import { PriorityBriefing, type PriorityBriefingProps } from "./PriorityBriefing.js";

export interface CampaignRowProps {
  readonly row: CampaignRowModel;
  readonly briefing?: PriorityBriefingProps | undefined;
  readonly monthLabel?: string | undefined;
}

export function CampaignRow({ row, briefing, monthLabel }: CampaignRowProps) {
  const { spec, bindToolbar } = useScreenHeaderSlot();
  const showBriefing = briefing !== undefined && spec === null;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-4 px-1 text-xs text-muted-foreground">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          ref={bindToolbar}
          className="flex min-w-0 flex-1 items-center gap-2 empty:hidden"
          style={NO_DRAG}
        />
        {showBriefing && <PriorityBriefing {...briefing} />}
        {row.metrics
          .filter((metric) => !metric.placeholder)
          .map((metric) => (
            <div key={metric.icon} className="flex shrink-0 items-center gap-3">
              {showBriefing && <Separator orientation="vertical" className="h-3" />}
              <CampaignMetric metric={metric} />
            </div>
          ))}
      </div>
      <div className="shrink-0 text-[12px]" style={NO_DRAG}>
        {spec !== null && monthLabel !== undefined && (
          <span className="mr-3 font-medium text-foreground">{monthLabel}</span>
        )}
        <span>
          {translate("shell.header.status.prefix")} <span>{row.status}</span>
        </span>
      </div>
    </div>
  );
}
