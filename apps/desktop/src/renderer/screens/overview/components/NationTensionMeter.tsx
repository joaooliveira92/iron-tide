import { cn } from "../../../lib/utils.js";
import { tensionLevel } from "../nation-rail-view.js";

const MAX_TENSION = 10;

const LEVEL_FILL = {
  calm: "bg-muted-foreground/50",
  elevated: "bg-primary",
  critical: "bg-destructive",
} as const;

export function NationTensionMeter({ tension }: { readonly tension: number }) {
  return (
    <div
      role="meter"
      aria-label={`Tension ${String(tension)} of ${String(MAX_TENSION)}`}
      aria-valuemin={0}
      aria-valuemax={MAX_TENSION}
      aria-valuenow={tension}
      data-level={tensionLevel(tension)}
      className="h-1 min-w-6 flex-1 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn("h-full rounded-full", LEVEL_FILL[tensionLevel(tension)])}
        style={{ width: `${String((tension / MAX_TENSION) * 100)}%` }}
      />
    </div>
  );
}
