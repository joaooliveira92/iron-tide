import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import type { AllocationSegment, StripTone } from "./status-strip-state.js";

export type SegmentId = AllocationSegment["id"];

export const SEGMENT_FILL: Record<SegmentId, string> = {
  obligations: "bg-admiralty-ink-faint",
  maintenance: "bg-admiralty-signal",
  research: "bg-warning",
  construction:
    "border border-admiralty-accent/70 bg-[repeating-linear-gradient(135deg,var(--color-admiralty-accent)_0_2px,transparent_2px_5px)]",
};

export const SEGMENT_TEXT: Record<SegmentId, string> = {
  obligations: "text-admiralty-ink-faint",
  maintenance: "text-admiralty-signal",
  research: "text-warning",
  construction: "text-admiralty-accent",
};

export const TONE_TEXT: Record<StripTone, string> = {
  normal: "text-foreground",
  alert: "font-semibold text-destructive",
};

export const TONE_FILL: Record<StripTone, string> = {
  normal: "bg-success",
  alert: "bg-destructive",
};

export {
  clamp01,
  percentString,
  Registration,
  SlateFoot as CardFoot,
  SlateHeader as CardHeader,
  SlateMeter as Meter,
  SlateStat as Stat,
} from "../components/ui/slate.js";
import { clamp01, percentString } from "../components/ui/slate.js";

export function Ring({
  fraction,
  tone,
  children,
}: {
  readonly fraction: number;
  readonly tone: string;
  readonly children?: ReactNode;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = clamp01(fraction) * circumference;
  return (
    <span className="relative inline-grid size-16 shrink-0 place-items-center" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${String(filled)} ${String(circumference)}`}
          className={cn("stroke-current transition-[stroke-dasharray] duration-500", tone)}
        />
      </svg>
      <span className="relative text-xs font-semibold tabular-nums">{children}</span>
    </span>
  );
}

export function Pips({
  filled,
  total,
  fill,
  className,
}: {
  readonly filled: number;
  readonly total: number;
  readonly fill: string;
  readonly className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("flex w-full gap-0.5", className)}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("h-1.5 flex-1 rounded-[1px]", index < filled ? fill : "bg-muted")}
        />
      ))}
    </span>
  );
}

export function Histogram({
  fractions,
  className,
}: {
  readonly fractions: readonly number[];
  readonly className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("flex h-5 w-full items-end gap-0.5", className)}>
      {fractions.map((fraction, index) => (
        <span
          key={index}
          className="bar-grow min-w-0.5 flex-1 rounded-t-[1px] bg-admiralty-signal/70"
          style={{
            height: percentString(Math.max(0.12, fraction)),
            animationDelay: `${String(index * 24)}ms`,
          }}
        />
      ))}
    </span>
  );
}

export function MiniLine({
  values,
  tone,
  className,
}: {
  readonly values: readonly number[];
  readonly tone: StripTone;
  readonly className?: string;
}) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const x = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const y = (v: number) => (span === 0 ? 50 : 90 - ((v - lo) / span) * 80);
  const points = values.map((v, i) => `${String(x(i))},${String(y(v))}`).join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("h-8 w-24", tone === "alert" ? "text-destructive" : "text-success", className)}
    >
      <polyline
        points={points}
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="line-draw"
      />
    </svg>
  );
}

export function SegmentStack({
  segments,
  className,
}: {
  readonly segments: readonly { readonly id: SegmentId; readonly fraction: number }[];
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted", className)}
    >
      {segments
        .filter((segment) => segment.fraction > 0)
        .map((segment) => (
          <span
            key={segment.id}
            className={cn("h-full min-w-px", SEGMENT_FILL[segment.id])}
            style={{ width: percentString(segment.fraction) }}
          />
        ))}
    </span>
  );
}
