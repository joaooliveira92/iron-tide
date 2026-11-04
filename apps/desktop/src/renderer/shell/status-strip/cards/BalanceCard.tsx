import { Scale } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import type { OutlookDetail } from "../../status-strip-state.js";
import type { TrendDetail } from "../../status-strip-trend.js";
import {
  CardFoot,
  CardHeader,
  percentString,
  SEGMENT_FILL,
  TONE_FILL,
  TONE_TEXT,
  type SegmentId,
} from "../StripGlyph.js";
import { StripTrend } from "../StripTrend.js";

interface WaterfallColumn {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly from: number;
  readonly to: number;
  readonly fill: string;
  readonly step: boolean;
}

function Waterfall({ outlook }: { readonly outlook: OutlookDetail }) {
  const { balance, steps } = outlook;
  const finalFraction = steps[steps.length - 1]?.remainderFraction ?? 1;
  const columns: readonly WaterfallColumn[] = [
    {
      id: "appropriation",
      label: "Budget",
      value: outlook.appropriation,
      from: 0,
      to: 1,
      fill: "bg-foreground/60",
      step: false,
    },
    ...steps.map((step, index) => ({
      id: step.id,
      label: step.label,
      value: step.value,
      from: step.remainderFraction,
      to: index === 0 ? 1 : (steps[index - 1]?.remainderFraction ?? 1),
      fill: SEGMENT_FILL[step.id as SegmentId],
      step: true,
    })),
    {
      id: "balance",
      label: "Balance",
      value: balance.value,
      from: 0,
      to: Math.max(finalFraction, balance.tone === "alert" ? 0.04 : 0),
      fill: TONE_FILL[balance.tone],
      step: true,
    },
  ];
  return (
    <ol className="grid grid-cols-5 gap-1.5">
      {columns.map((column, index) => (
        <li
          key={column.id}
          {...(column.step ? { "data-step": column.id } : {})}
          className="min-w-0 space-y-1"
        >
          <span className="slate-grid relative block h-20 overflow-hidden rounded-sm border border-border/60 bg-muted/30">
            <span
              aria-hidden="true"
              className={cn("bar-grow absolute inset-x-1.5 rounded-[2px]", column.fill)}
              style={{
                bottom: percentString(column.from),
                height: percentString(Math.max(0.02, column.to - column.from)),
                animationDelay: `${String(index * 60)}ms`,
              }}
            />
          </span>
          <span className="block truncate text-center text-xs text-muted-foreground">
            {column.label}
          </span>
          <span
            title={column.value}
            className={cn(
              "block truncate text-center text-xs font-medium tabular-nums",
              column.id === "balance" && TONE_TEXT[balance.tone],
            )}
          >
            {column.value}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BalanceCard({
  outlook,
  trend,
}: {
  readonly outlook: OutlookDetail;
  readonly trend?: TrendDetail | null;
}) {
  const { balance } = outlook;
  return (
    <>
      <CardHeader
        title="Balance breakdown"
        icon={<Scale className="size-3.5" />}
        tone={balance.tone}
        aside={
          <span
            className={cn("text-xs font-semibold uppercase tracking-wide", TONE_TEXT[balance.tone])}
          >
            {balance.status}
          </span>
        }
      />
      <div className="space-y-3 px-3 py-3">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted-foreground">Monthly appropriation</span>
          <span className="font-display text-xl leading-6 font-semibold tabular-nums">
            {outlook.appropriation}
          </span>
        </p>
        <Waterfall outlook={outlook} />
        <div className="flex items-baseline justify-between gap-3 rounded-md border border-dashed border-admiralty-accent/50 px-2 py-1.5 text-xs">
          <span className="text-muted-foreground">With construction at its upper bound</span>
          <span
            className={cn("font-medium tabular-nums", TONE_TEXT[outlook.afterConstruction.tone])}
          >
            {outlook.afterConstruction.value}
          </span>
        </div>
        {trend !== undefined && trend !== null && (
          <div data-trend="net" className="space-y-1 border-t border-border/60 pt-2">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Actual net, last {trend.months} {trend.months === 1 ? "month" : "months"}
              </span>
              <StripTrend variant="delta" series={trend.net} />
            </div>
            <StripTrend
              variant="spark"
              series={trend.net}
              title="Actual monthly net"
              baseline="zero"
            />
          </div>
        )}
      </div>
      <CardFoot>
        Deficits are spelled out as well as coloured. Lines the campaign does not model are left
        out, not counted as zero.
      </CardFoot>
    </>
  );
}
