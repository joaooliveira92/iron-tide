import { useId } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "../../lib/utils.js";
import type { TrendDirection, TrendSeries } from "../status-strip-trend.js";

const DIRECTION_WORD: Record<TrendDirection, string> = {
  up: "up",
  down: "down",
  flat: "unchanged",
};

export type StripTrendProps =
  | {
      readonly variant: "delta";
      readonly series: TrendSeries;
      readonly className?: string;
    }
  | {
      readonly variant: "spark";
      readonly series: TrendSeries;
      readonly title: string;
      readonly baseline?: "zero";
      readonly projected?: number;
    };

export function StripTrend(props: StripTrendProps) {
  if (props.variant === "delta") {
    return <TrendDelta series={props.series} className={props.className} />;
  }
  return (
    <TrendSpark
      series={props.series}
      title={props.title}
      baseline={props.baseline}
      projected={props.projected}
    />
  );
}

function TrendDelta({
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

function TrendSpark({
  series,
  title,
  baseline,
  projected,
}: {
  readonly series: TrendSeries;
  readonly title: string;
  readonly baseline?: "zero";
  readonly projected?: number;
}) {
  const gradient = useId();
  const { values, labels } = series;
  const withProjection = projected === undefined ? values : [...values, projected];
  const zeroLine = baseline === "zero";
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
