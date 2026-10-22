import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Anchor, Flag, Hourglass, Minus, Ship } from "lucide-react";

import { cn } from "../lib/utils.js";
import { formatTons } from "./status-strip-state.js";
import { usePresentationFormat } from "./usePresentationFormat.js";
import type { TrendDetail, TrendDirection, TrendSeries } from "./status-strip-trend.js";
import type {
  AllocationSegment,
  BudgetAllocation,
  OutlookDetail,
  PortDetail,
  StationDetail,
  StripTone,
} from "./status-strip-state.js";

export const SEGMENT_FILL: Record<AllocationSegment["id"], string> = {
  obligations: "bg-muted-foreground/60",
  maintenance: "bg-primary/70",
  research: "bg-warning/80",
  construction: "border border-dashed border-primary/60 bg-primary/10",
};

const TONE_TEXT: Record<StripTone, string> = {
  normal: "text-foreground",
  alert: "font-semibold text-destructive",
};

const LINE_MEANING: Record<AllocationSegment["id"], string> = {
  obligations: "Fixed monthly commitments that are charged before anything else.",
  maintenance: "Fleet upkeep, charged every month and higher in wartime.",
  research: "The standing research budget the engine will actually pay next month.",
  construction:
    "An upper bound on shipbuilding: what the yards can absorb, before the treasury limits it. Not part of committed expenses.",
};

export function CardHeader({
  icon,
  title,
  aside,
}: {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
      <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{title}</span>
      </p>
      {aside}
    </div>
  );
}

export function CardFoot({ children }: { readonly children: ReactNode }) {
  return (
    <p className="border-t bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">
      {children}
    </p>
  );
}

function Meter({
  fraction,
  fill,
  className,
}: {
  readonly fraction: number;
  readonly fill: string;
  readonly className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <span
      aria-hidden="true"
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <span
        className={cn("block h-full rounded-full", fill)}
        style={{ width: `${String(Math.round(clamped * 1000) / 10)}%` }}
      />
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: StripTone;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-xs font-medium tabular-nums", TONE_TEXT[tone])}>{value}</dd>
    </div>
  );
}

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
}: {
  readonly series: TrendSeries;
  readonly title: string;
  readonly zeroLine?: boolean;
}) {
  const { values, labels } = series;
  const lo = Math.min(...values, ...(zeroLine ? [0] : []));
  const hi = Math.max(...values, ...(zeroLine ? [0] : []));
  const span = hi - lo;
  const x = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const y = (v: number) => (span === 0 ? 50 : 88 - ((v - lo) / span) * 76);
  const points = values.map((v, i) => `${String(x(i))},${String(y(v))}`).join(" ");
  const lastIndex = values.length - 1;
  const first = labels[0];
  const last = labels[lastIndex];
  return (
    <div
      role="img"
      data-spark={title}
      aria-label={`${title}: ${values.length} points from ${first ?? ""} to ${last ?? ""}, latest ${series.current}`}
      className="space-y-0.5"
    >
      <div className="relative h-8" aria-hidden="true">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
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
              className="text-muted-foreground/50"
            />
          )}
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
          />
        </svg>
        <span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-popover"
          style={{ left: `${String(x(lastIndex))}%`, top: `${String(y(values[lastIndex] ?? 0))}%` }}
        />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{first}</span>
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
        icon={
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-sm", SEGMENT_FILL[segment.id])}
          />
        }
        aside={
          <span className="text-xs font-medium text-muted-foreground">
            {planned ? "Upper bound" : "Committed"}
          </span>
        }
      />
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg leading-6 font-semibold tabular-nums">{segment.value}</span>
          <span className="text-xs text-muted-foreground">per month</span>
        </div>
        <div className="space-y-1">
          <Meter fraction={segment.fraction} fill={SEGMENT_FILL[segment.id]} />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{segment.percent} of the appropriation</span>
            <span>{allocation.appropriation}</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-1.5">
          <Stat label="Over a year" value={segment.yearly} />
          <Stat
            label={planned ? "In committed total" : "Of committed total"}
            value={planned ? "Not included" : segment.shareOfCommitted}
          />
        </dl>
      </div>
      <CardFoot>
        {note === "" ? LINE_MEANING[segment.id] : `${LINE_MEANING[segment.id]} ${note}`}
      </CardFoot>
    </>
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
        aside={
          <span
            className={cn("text-xs font-semibold uppercase tracking-wide", TONE_TEXT[balance.tone])}
          >
            {balance.status}
          </span>
        }
      />
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Monthly appropriation</span>
          <span className="font-semibold tabular-nums">{outlook.appropriation}</span>
        </div>
        <ol className="space-y-1.5">
          {outlook.steps.map((step) => (
            <li key={step.id} data-step={step.id} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{step.label}</span>
                <span className="tabular-nums">
                  <span className="font-medium">{step.value}</span>
                  <span className="ml-2 text-muted-foreground">
                    <ArrowRight className="mr-1 inline size-3" aria-hidden="true" />
                    {step.remainder}
                  </span>
                </span>
              </div>
              <Meter
                fraction={step.remainderFraction}
                fill={SEGMENT_FILL[step.id as AllocationSegment["id"]]}
              />
            </li>
          ))}
        </ol>
        <div
          data-step="balance"
          className={cn(
            "flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5",
            balance.tone === "alert" ? "bg-destructive/10" : "bg-success/10",
          )}
        >
          <span className="text-xs font-semibold">Monthly balance</span>
          <span className="text-sm font-semibold tabular-nums">{balance.value}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground">With construction at its upper bound</span>
          <span
            className={cn("font-medium tabular-nums", TONE_TEXT[outlook.afterConstruction.tone])}
          >
            {outlook.afterConstruction.value}
          </span>
        </div>
        {trend !== undefined && trend !== null && (
          <div data-trend="net" className="space-y-1 border-t pt-2">
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
      <CardHeader title="Treasury" icon={<Hourglass className="size-3.5" aria-hidden="true" />} />
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-md bg-muted/40 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Now</p>
            <p className="text-sm font-semibold tabular-nums">{outlook.treasury}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1 rounded-md bg-muted/40 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Next month end</p>
            <p className="text-sm font-semibold tabular-nums">{outlook.monthEndTreasury}</p>
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
          <div data-trend="treasury" className="space-y-1 border-t pt-2">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Treasury, last {trend.months} {trend.months === 1 ? "month" : "months"}
              </span>
              <TrendDelta series={trend.treasury} />
            </div>
            <TrendSpark series={trend.treasury} title="Treasury" />
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
      <CardHeader
        title="Foreign stations"
        icon={<Flag className="size-3.5" aria-hidden="true" />}
      />
      <div className="space-y-2 px-3 py-2.5">
        {stations.unknown ? (
          <p className="text-xs text-muted-foreground">
            The map could not be read, so the split cannot be shown.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Meter fraction={share ?? 0} fill="bg-primary/70" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {stations.foreign} of {stations.total} {stations.total === 1 ? "ship" : "ships"} in
                areas held by another nation
              </p>
              {stations.foreignTons !== null && stations.totalTons !== null && (
                <p
                  data-stat="foreign-tons"
                  className="text-xs font-medium tabular-nums text-foreground"
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
                    className="rounded-md bg-muted/40 px-2 py-1"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1 font-medium">
                        <Ship className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{group.areaName}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {group.ships.length} {group.ships.length === 1 ? "ship" : "ships"}
                        {group.tons !== null && ` · ${group.tons}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Held by {group.controller}</p>
                    <ul className="text-xs leading-snug">
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
        icon={<Anchor className="size-3.5" aria-hidden="true" />}
        aside={<span className="text-xs font-semibold tabular-nums">{total}</span>}
      />
      <div className="px-3 py-2.5">
        {ports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ports are listed for this nation.</p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {ports.map((port) => (
              <li key={port.id} data-port={port.id} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{port.name}</span>
                    <span className="text-muted-foreground"> · {port.areaName}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{port.capacity}</span>
                </div>
                <Meter fraction={port.fraction} fill="bg-primary/70" />
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
