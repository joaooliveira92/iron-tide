import { cn } from "../../lib/utils.js";
import type { Delta } from "./optionDelta.js";

const ARROW = { up: "↑", down: "↓", flat: "→" } as const;
const DIRECTION = { up: "up", down: "down", flat: "unchanged" } as const;
const TONE_CLASS = {
  better: "text-emerald-600 dark:text-emerald-400",
  worse: "text-red-600 dark:text-red-400",
  neutral: "text-foreground",
} as const;

export function DeltaPreview({
  deltas,
  label = "Change",
}: {
  readonly deltas: readonly Delta[];
  readonly label?: string;
}) {
  if (deltas.length === 0) return null;
  return (
    <ul
      data-testid="delta-preview"
      aria-label={label}
      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
    >
      {deltas.map((d) => {
        const tone = d.tone ?? "neutral";
        return (
          <li key={d.id} data-delta={d.id} data-tone={tone} className="flex items-baseline gap-1">
            <span>{d.label}</span>
            <span className={cn("tabular-nums", TONE_CLASS[tone])}>
              <span aria-hidden="true">{ARROW[d.direction]} </span>
              <span className="sr-only">{DIRECTION[d.direction]} </span>
              {d.text}
              {tone !== "neutral" && <span className="font-medium"> ({tone})</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
