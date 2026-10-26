import { useId } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Anchor,
  Crown,
  Flag,
  Hourglass,
  Minus,
  Scale,
  Ship,
} from "lucide-react";

import type { ExplanationTree } from "@bluewave/events";

import { cn } from "../lib/utils.js";
import { ExplanationDisclosure } from "../components/shared/ExplanationDisclosure.js";
import {
  CardFoot,
  CardHeader,
  clamp01,
  Meter,
  percentString,
  Ring,
  SEGMENT_FILL,
  SEGMENT_TEXT,
  SegmentStack,
  Stat,
  TONE_FILL,
  TONE_TEXT,
  type SegmentId,
} from "./StatusStripGlyphs.js";
import { formatTons } from "./status-strip-state.js";
import { usePresentationFormat } from "./usePresentationFormat.js";
import type { TrendDetail, TrendDirection, TrendSeries } from "./status-strip-trend.js";
import type {
  AllocationSegment,
  BudgetAllocation,
  OutlookDetail,
  PortDetail,
  PrestigeGauge,
  StationDetail,
} from "./status-strip-state.js";

export { CardFoot, CardHeader, SEGMENT_FILL } from "./StatusStripGlyphs.js";

const LINE_MEANING: Record<SegmentId, string> = {
  obligations: "Fixed monthly commitments that are charged before anything else.",
  maintenance: "Fleet upkeep, charged every month and higher in wartime.",
  research: "The standing research budget the engine will actually pay next month.",
  construction:
    "An upper bound on shipbuilding: what the yards can absorb, before the treasury limits it. Not part of committed expenses.",
};

const DIRECTION_WORD: Record<TrendDirection, string> = {
  up: "up",
  down: "down",
  flat: "unchanged",
};

export function TrendDelta({
  series,
  className,
}: {
  readonly series: TrendSeries;
  readonly className?: string;
}) {
  if (series.delta === null || series.direction === null) return null;
  const Icon =
    series.direction === "up" ? ArrowUp : series.direction === "down" ? ArrowDown : Minus;
  const previous = series.labels[series.labels.length - 2];
  return (
    <span
      data-trend-delta={series.direction}
      className={cn("inline-flex items-center gap-0.5 tabular-nums", className)}
    >
      <Icon
        className={cn(
          "size-3",
          series.direction === "up" && "text-success",
          series.direction === "down" && "text-destructive",
        )}
        aria-hidden="true"
      />
      <span className="font-medium">{series.delta}</span>
      <span className="sr-only">
        {` ${DIRECTION_WORD[series.direction]} on ${previous ?? "the previous month"}`}
      </span>
    </span>
  );
}

export function TrendSpark({
  series,
  title,
  zeroLine = false,
  projected,
}: {
  readonly series: TrendSeries;
  readonly title: string;
  readonly zeroLine?: boolean;
  readonly projected?: number;
}) {
  const gradient = useId();
  const { values, labels } = series;
  const withProjection = projected === undefined ? values : [...values, projected];
  const lo = Math.min(...withProjection, ...(zeroLine ? [0] : []));
  const hi = Math.max(...withProjection, ...(zeroLine ? [0] : []));
  const span = hi - lo;
  const count = withProjection.length;
  const x = (i: number) => (count === 1 ? 50 : (i / (count - 1)) * 100);
  const y = (v: number) => (span === 0 ? 50 : 88 - ((v - lo) / span) * 76);
  const lastIndex = values.length - 1;
  const lastValue = values[lastIndex] ?? 0;
  const line = values.map((v, i) => `${String(x(i))},${String(y(v))}`).join(" ");
  const area = `${String(x(0))},100 ${line} ${String(x(lastIndex))},100`;
  const first = labels[0];
  const last = labels[lastIndex];
  return (
    <div
      role="img"
      data-spark={title}
      aria-label={`${title}: ${values.length} points from ${first ?? ""} to ${last ?? ""}, latest ${series.current}`}
      className="space-y-1"
    >
      <div className="relative h-14" aria-hidden="true">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id={gradient}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
              className="text-admiralty-signal"
            >
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((row) => (
            <line
              key={row}
              x1="0"
              x2="100"
              y1={row}
              y2={row}
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="text-border"
            />
          ))}
          {zeroLine && lo < 0 && hi > 0 && (
            <line
              x1="0"
              x2="100"
              y1={y(0)}
              y2={y(0)}
              stroke="currentColor"
              strokeDasharray="2 3"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="text-muted-foreground/70"
            />
          )}
          {values.length > 1 && (
            <polygon points={area} fill={`url(#${gradient})`} className="text-admiralty-signal" />
          )}
          <polyline
            points={line}
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="line-draw text-admiralty-signal"
          />
          {projected !== undefined && (
            <line
              x1={x(lastIndex)}
              y1={y(lastValue)}
              x2={x(lastIndex + 1)}
              y2={y(projected)}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              className="text-admiralty-accent"
            />
          )}
        </svg>
        {projected !== undefined && (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-admiralty-accent bg-popover"
            style={{ left: `${String(x(lastIndex + 1))}%`, top: `${String(y(projected))}%` }}
          />
        )}
        <span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${String(x(lastIndex))}%`, top: `${String(y(lastValue))}%` }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-admiralty-signal/60 motion-reduce:animate-none" />
          <span className="absolute inset-0 rounded-full bg-admiralty-signal ring-2 ring-popover" />
        </span>
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{first}</span>
        {projected !== undefined && <span className="text-admiralty-accent">projected</span>}
        {lastIndex > 0 && <span>{last}</span>}
      </div>
    </div>
  );
}

export function BudgetLineCard({
  segment,
  allocation,
  note,
}: {
  readonly segment: AllocationSegment;
  readonly allocation: BudgetAllocation;
  readonly note: string;
}) {
  const planned = segment.kind === "planned";
  return (
    <>
      <CardHeader
        title={segment.label}
        icon={<span className={cn("size-2.5 rounded-sm", SEGMENT_FILL[segment.id])} />}
        aside={
          <span className="rounded-sm border border-border/70 px-1.5 text-xs font-medium text-muted-foreground">
            {planned ? "Upper bound" : "Committed"}
          </span>
        }
      />
      <div className="flex items-center gap-3 px-3 py-3">
        <Ring fraction={segment.fraction} tone={SEGMENT_TEXT[segment.id]}>
          {segment.percent}
        </Ring>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-xl leading-6 font-semibold tabular-nums">
            {segment.value}
            <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">
              per month
            </span>
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            of the {allocation.appropriation} appropriation
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-1.5 px-3 pb-3">
        <Stat label="Over a year" value={segment.yearly} />
        <Stat
          label={planned ? "In committed total" : "Of committed total"}
          value={planned ? "Not included" : segment.shareOfCommitted}
        />
      </dl>
      <CardFoot>
        {note === "" ? LINE_MEANING[segment.id] : `${LINE_MEANING[segment.id]} ${note}`}
      </CardFoot>
    </>
  );
}

export function BudgetSummaryCard({ allocation }: { readonly allocation: BudgetAllocation }) {
  return (
    <>
      <CardHeader
        title="Budget"
        icon={<Scale className="size-3.5" />}
        tone={allocation.overCommitted ? "alert" : "normal"}
        aside={
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {allocation.committed.value} of {allocation.appropriation}
          </span>
        }
      />
      <div className="space-y-2 px-3 py-3">
        <SegmentStack segments={allocation.segments} className="h-2.5" />
        <ul className="space-y-1">
          {allocation.segments.map((segment) => (
            <li key={segment.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-sm", SEGMENT_FILL[segment.id])}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums">{segment.value}</span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">
                {segment.percent}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <CardFoot>
        {allocation.overCommitted
          ? "Over-committed: the committed lines exceed the monthly appropriation."
          : "Committed lines against the monthly appropriation. Open the full strip for each line."}
      </CardFoot>
    </>
  );
}

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
              <TrendDelta series={trend.net} />
            </div>
            <TrendSpark series={trend.net} title="Actual monthly net" zeroLine />
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
              <TrendDelta series={trend.treasury} />
            </div>
            <TrendSpark
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

export function PrestigeCard({
  gauge,
  note,
  explanation,
}: {
  readonly gauge: PrestigeGauge;
  readonly note: string;
  readonly explanation?: ExplanationTree;
}) {
  const format = usePresentationFormat();
  const margin = gauge.current - gauge.threshold;
  return (
    <>
      <CardHeader
        title="Prestige"
        icon={<Crown className="size-3.5" />}
        tone={gauge.atRisk ? "alert" : "normal"}
        aside={
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              gauge.atRisk ? "text-destructive" : "text-success",
            )}
          >
            {gauge.atRisk ? "Dismissal risk" : "Secure"}
          </span>
        }
      />
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl leading-7 font-semibold tabular-nums">
            {gauge.current}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {margin >= 0 ? `${String(margin)} above` : `${String(-margin)} below`} the sacking line
          </span>
        </div>
        <div className="space-y-1">
          <Meter
            fraction={gauge.fraction}
            mark={gauge.thresholdFraction}
            fill={gauge.atRisk ? "bg-destructive" : "bg-admiralty-accent"}
            className="h-2"
          />
          <div className="relative h-4 text-xs tabular-nums text-muted-foreground">
            <span className="absolute left-0">0</span>
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-foreground"
              style={{ left: percentString(clamp01(gauge.thresholdFraction)) }}
            >
              sacked at {gauge.threshold}
            </span>
          </div>
        </div>
        {explanation === undefined ? null : (
          <ExplanationDisclosure
            tree={explanation}
            area="strategic"
            summaryKey="strategic.prestige_change.summary"
            format={format}
            testId="prestige-change-explanation"
          />
        )}
      </div>
      <CardFoot>{note}</CardFoot>
    </>
  );
}

export function StationsCard({ stations }: { readonly stations: StationDetail }) {
  const format = usePresentationFormat();
  const byTonnage = stations.foreignTonsFraction !== null;
  const share = byTonnage
    ? stations.foreignTonsFraction
    : stations.total === 0
      ? 0
      : stations.foreign / stations.total;
  return (
    <>
      <CardHeader title="Foreign stations" icon={<Flag className="size-3.5" />} />
      <div className="space-y-3 px-3 py-3">
        {stations.unknown ? (
          <p className="text-xs text-muted-foreground">
            The map could not be read, so the split cannot be shown.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Meter fraction={share ?? 0} fill="bg-admiralty-signal" className="h-2" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {stations.foreign} of {stations.total} {stations.total === 1 ? "ship" : "ships"} in
                areas held by another nation
              </p>
              {stations.foreignTons !== null && stations.totalTons !== null && (
                <p
                  data-stat="foreign-tons"
                  className="font-display text-base font-semibold tabular-nums text-foreground"
                >
                  {stations.foreignTons} of {stations.totalTons}
                </p>
              )}
            </div>
            {stations.foreignGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Every ship is in your own areas or an unclaimed sea.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {stations.foreignGroups.map((group) => (
                  <li
                    key={group.areaId}
                    data-area={group.areaId}
                    className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1 font-medium">
                        <Ship
                          className="size-3 shrink-0 text-admiralty-signal"
                          aria-hidden="true"
                        />
                        <span className="truncate">{group.areaName}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {group.ships.length} {group.ships.length === 1 ? "ship" : "ships"}
                        {group.tons !== null && ` · ${group.tons}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Held by {group.controller}</p>
                    <ul className="mt-1 border-t border-border/50 pt-1 text-xs leading-snug">
                      {group.ships.map((ship) => (
                        <li key={ship.name} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{ship.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {ship.tons === null ? "tonnage unknown" : formatTons(ship.tons, format)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <CardFoot>
        {stations.foreignTons === null && !stations.unknown && stations.foreign > 0
          ? "Tonnage is left out because at least one ship's design displacement is not loaded; a partial total would mislead."
          : "Tonnage is each ship's design displacement in metric tons. The bar shows the foreign share by tonnage."}
      </CardFoot>
    </>
  );
}

export function ShipyardCard({
  ports,
  total,
}: {
  readonly ports: readonly PortDetail[];
  readonly total: string;
}) {
  return (
    <>
      <CardHeader
        title="Shipyard capacity"
        icon={<Anchor className="size-3.5" />}
        aside={<span className="font-display text-sm font-semibold tabular-nums">{total}</span>}
      />
      <div className="px-3 py-3">
        {ports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ports are listed for this nation.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {ports.map((port) => (
              <li key={port.id} data-port={port.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{port.name}</span>
                    <span className="text-muted-foreground"> · {port.areaName}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{port.capacity}</span>
                </div>
                <Meter fraction={port.fraction} fill="bg-admiralty-signal" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <CardFoot>
        The sum of your ports&rsquo; levels, a stand-in for RTW3 shipyard capacity until per-port
        facilities land.
      </CardFoot>
    </>
  );
}
