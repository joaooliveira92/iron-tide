import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Circle, Pause, Zap } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { statusMeta, type StatusTone } from "../yard-workspace.js";

const ICON: Record<StatusTone, LucideIcon> = {
  live: Circle,
  fast: Zap,
  held: Pause,
  bad: AlertTriangle,
  done: CheckCircle2,
};

const TONE: Record<StatusTone, string> = {
  live: "bg-info/15 text-info",
  fast: "bg-primary/15 text-foreground",
  held: "bg-warning/15 text-amber-700 dark:text-amber-400",
  bad: "bg-destructive/15 text-destructive",
  done: "bg-success/15 text-success",
};

export function StatusChip({
  status,
  className,
}: {
  readonly status: string;
  readonly className?: string;
}) {
  const { label, tone } = statusMeta(status);
  const Icon = ICON[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      <span>{label}</span>
    </span>
  );
}
