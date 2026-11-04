import { ArrowRight, Hourglass } from "lucide-react";

import type { OutlookDetail } from "../../status-strip-state.js";
import type { TrendDetail } from "../../status-strip-trend.js";
import { CardFoot, CardHeader, Stat } from "../StripGlyph.js";
import { StripTrend } from "../StripTrend.js";

export function TreasuryCard({
  outlook,
  trend,
}: {
  readonly outlook: OutlookDetail;
  readonly trend?: TrendDetail | null;
}) {
  return (
    <>
      <CardHeader title="Treasury" icon={<Hourglass className="size-3.5" />} />
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
            <p className="text-xs text-muted-foreground">Now</p>
            <p className="font-display text-base font-semibold tabular-nums">{outlook.treasury}</p>
          </div>
          <ArrowRight
            className="size-4 shrink-0 self-center text-admiralty-accent"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 rounded-md border border-admiralty-accent/40 bg-admiralty-accent/5 px-2.5 py-1.5">
            <p className="text-xs text-muted-foreground">Next month end</p>
            <p className="font-display text-base font-semibold tabular-nums">
              {outlook.monthEndTreasury}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-1.5">
          <Stat label="Monthly balance" value={outlook.balance.value} tone={outlook.balance.tone} />
          <Stat label="Runway" value={outlook.runway ?? "Not draining"} />
          {outlook.shortfall !== null && (
            <Stat label="Unpaid costs" value={outlook.shortfall} tone="alert" />
          )}
        </dl>
        {trend !== undefined && trend !== null && (
          <div data-trend="treasury" className="space-y-1 border-t border-border/60 pt-2">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Treasury, last {trend.months} {trend.months === 1 ? "month" : "months"}
              </span>
              <StripTrend variant="delta" series={trend.treasury} />
            </div>
            <StripTrend
              variant="spark"
              series={trend.treasury}
              title="Treasury"
              projected={outlook.monthEndTreasuryValue}
            />
          </div>
        )}
      </div>
      <CardFoot>
        Month-end assumes construction is spent at its upper bound. A shortfall is never carried
        into the next month.
      </CardFoot>
    </>
  );
}
