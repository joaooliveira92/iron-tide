import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";

export type SlateTone = "normal" | "alert";

export const SLATE_TONE_TEXT: Record<SlateTone, string> = {
  normal: "text-foreground",
  alert: "font-semibold text-destructive",
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function percentString(fraction: number): string {
  return `${String(Math.round(clamp01(fraction) * 1000) / 10)}%`;
}

export function Registration() {
  const corner = "pointer-events-none absolute size-1.5 border-admiralty-accent/60";
  return (
    <>
      <span aria-hidden="true" className={cn(corner, "left-1 top-1 border-l border-t")} />
      <span aria-hidden="true" className={cn(corner, "right-1 top-1 border-r border-t")} />
      <span aria-hidden="true" className={cn(corner, "bottom-1 left-1 border-b border-l")} />
      <span aria-hidden="true" className={cn(corner, "bottom-1 right-1 border-b border-r")} />
    </>
  );
}

export function SlateHeader({
  icon,
  title,
  aside,
  tone = "normal",
  className,
}: {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly aside?: ReactNode;
  readonly tone?: SlateTone;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "slate-grid relative flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent",
          tone === "alert" ? "via-destructive" : "via-admiralty-accent/80",
        )}
      />
      <p className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold tracking-tight">
        {icon !== undefined && (
          <span
            aria-hidden="true"
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-sm",
              tone === "alert"
                ? "bg-destructive/15 text-destructive"
                : "bg-admiralty-accent/15 text-admiralty-accent",
            )}
          >
            {icon}
          </span>
        )}
        <span className="truncate">{title}</span>
      </p>
      {aside}
    </div>
  );
}

export function SlateFoot({ children }: { readonly children: ReactNode }) {
  return (
    <p className="border-t border-border/70 bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">
      {children}
    </p>
  );
}

export function SlateMeter({
  fraction,
  fill,
  className,
  mark,
}: {
  readonly fraction: number;
  readonly fill: string;
  readonly className?: string;
  readonly mark?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-inner",
        className,
      )}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: percentString(fraction) }}
      />
      {mark !== undefined && (
        <span
          className="absolute inset-y-0 w-px bg-foreground/80"
          style={{ left: percentString(mark) }}
        />
      )}
    </span>
  );
}

export function SlateStat({
  label,
  value,
  tone = "normal",
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: SlateTone;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-muted/30 px-2 py-1">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-xs font-medium tabular-nums", SLATE_TONE_TEXT[tone])}>{value}</dd>
    </div>
  );
}

export function SlateBody({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn("space-y-2 px-3 py-3", className)}>{children}</div>;
}

export interface SlateFactRow {
  readonly label: string;
  readonly value: string;
  readonly tone?: SlateTone;
}

export function SlateFacts({
  rows,
  className,
}: {
  readonly rows: readonly SlateFactRow[];
  readonly className?: string;
}) {
  return (
    <dl className={cn("space-y-1", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 pb-1 last:border-0 last:pb-0"
        >
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "text-xs font-medium tabular-nums",
              SLATE_TONE_TEXT[row.tone ?? "normal"],
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
