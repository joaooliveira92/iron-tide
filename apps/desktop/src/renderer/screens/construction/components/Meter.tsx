import { cn } from "../../../lib/utils.js";

export type MeterTone = "primary" | "ok" | "warn" | "bad";

const FILL: Record<MeterTone, string> = {
  primary: "bg-primary",
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
};

export interface MeterProps {
  readonly pct: number;
  readonly tone?: MeterTone;
  readonly className?: string;
}

export function Meter({ pct, tone = "primary", className }: MeterProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", FILL[tone])}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
